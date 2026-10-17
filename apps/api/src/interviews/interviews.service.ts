import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  type InterviewReport,
  type InterviewSession,
  type InterviewWarning,
  type LiveInterviewQuestion,
  type LiveInterviewTurn,
  type ResumeContent,
} from '@careerbridge/shared';
import type { Interview, Prisma } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { USABLE_RESUME_WHERE } from '../resumes/resume-eligibility';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { InterviewAiService, profileFromResume, type InterviewProfile } from './interview-ai.service';
import {
  CONDUCT_MAX_WARNINGS,
  conductTerminateMessage,
  conductWarningMessage,
  countConductWarnings,
  detectConduct,
} from './interview-conduct';
import { renderInterviewPdf } from './interview-pdf';
import { countAnsweredQuestions, isAnsweredQuestion, isAudioPlaceholderAnswer } from './interview-answer.util';
import { TestimonialsService } from '../testimonials/testimonials.service';

/** Persisted question shape; ragChunkIds stays server-side and is stripped from API responses. */
type StoredLiveQuestion = LiveInterviewQuestion & { ragChunkIds?: string[] };
type AnswerScoreOptions = { answerMode: 'TEXT' | 'AUDIO'; durationSec: number; category?: string | null };
type AnswerAnalysis = Awaited<ReturnType<InterviewAiService['analyzeAnswer']>>;

const SCORING_PLACEHOLDER = 'Scoring in progress…';

function isPendingScore(item: LiveInterviewQuestion) {
  return item.score == null || !item.analysis || item.analysis === SCORING_PLACEHOLDER;
}

function alreadyAnswered() {
  return new ConflictException({
    code: ErrorCode.BUSINESS_RULE_VIOLATION,
    message: 'This question was already answered. Refresh to continue with the next question.',
  });
}

function interviewEnded() {
  return new BadRequestException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message: 'This interview has already ended.' });
}

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);
  /** Chains deferred Gemini scoring so endLive waits and concurrent writes don't clobber. */
  private readonly pendingScores = new Map<string, Promise<void>>();
  private readonly endInflight = new Map<string, Promise<InterviewSession>>();
  private readonly startInflight = new Map<string, Promise<InterviewSession>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly ai: InterviewAiService,
    private readonly testimonials: TestimonialsService,
  ) {}

  async list(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.interview.findMany({
      where: { candidateId: candidate.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toSession(row));
  }

  async start(userId: string, jobRole: string, interviewType: string) {
    const candidate = await this.requireCandidate(userId);
    const questions = this.intelligence.questions(interviewType);
    const created = await this.prisma.interview.create({
      data: {
        candidateId: candidate.id,
        jobRole,
        interviewType,
        questionsJson: JSON.stringify(questions),
        mode: 'CLASSIC',
      },
    });
    return this.toSession(created);
  }

  async createLive(
    userId: string,
    dto: {
      jobRole?: string;
      interviewType: string;
      difficulty?: string;
      questionCount?: number;
      durationLimitMin: number;
      source: 'PASSPORT' | 'UPLOAD';
      content?: Partial<ResumeContent>;
    },
  ) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: {
        skills: true,
        education: true,
        experiences: true,
        // Archived or unusable (failed / still processing) resumes must never feed interview context.
        resumes: {
          where: USABLE_RESUME_WHERE,
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    const content =
      dto.source === 'UPLOAD' && dto.content
        ? (dto.content as ResumeContent)
        : passportContent(candidate);
    const interests = parseJson<string[]>(candidate.careerInterests, []);
    const role =
      dto.jobRole ||
      candidate.resumes[0]?.targetJobTitle ||
      content.experiences?.[0]?.jobTitle ||
      interests[0] ||
      'Career role';
    const years = (candidate.totalExperienceYears || 0) + (candidate.totalExperienceMonths || 0) / 12;
    const band = years < 1 ? 'FRESHER' : years < 2 ? 'YEAR_1' : years < 4 ? 'YEAR_2_3' : 'YEAR_4_PLUS';
    const questionLimit = dto.questionCount != null ? clampQuestionLimit(dto.questionCount) : 15;
    const interviewType = normalizeInterviewType(dto.interviewType);
    const parsedResume = await this.prisma.resume.findFirst({
      where: { candidateId: candidate.id, processingStatus: 'COMPLETED', archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    const created = await this.prisma.interview.create({
      data: {
        candidateId: candidate.id,
        jobRole: role,
        interviewType,
        questionsJson: '[]',
        answersJson: '[]',
        mode: 'LIVE_AI',
        source: dto.source,
        difficulty: dto.difficulty || band,
        durationLimitMin: dto.durationLimitMin,
        profileJson: JSON.stringify({
          ...content,
          experienceYears: years,
          questionLimit,
          requestedDifficulty: SETUP_DIFFICULTIES.has(dto.difficulty ?? '') ? dto.difficulty : undefined,
          candidateId: candidate.id,
          resumeId: parsedResume?.id,
        }),
        transcriptJson: '[]',
        warningsJson: '[]',
      },
    });
    return this.toSession(created);
  }

  async startLive(userId: string, id: string) {
    const interview = await this.requireInterview(userId, id);
    if (interview.mode !== 'LIVE_AI') {
      throw new BadRequestException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message: 'This interview is not an AI live session.' });
    }
    if (interview.status === 'COMPLETED') return this.toSession(interview);
    if (interview.startAt) return this.toSession(interview);
    const inflight = this.startInflight.get(interview.id);
    if (inflight) return inflight;
    const run = this.beginLive(interview).finally(() => this.startInflight.delete(interview.id));
    this.startInflight.set(interview.id, run);
    return run;
  }

  private async beginLive(interview: Interview) {
    const profile = this.profileOf(interview);
    const first = await this.ai.firstQuestion(profile, interview.interviewType);
    const question: StoredLiveQuestion = {
      id: crypto.randomUUID(),
      number: 1,
      text: first.text,
      category: first.category,
      difficulty: interview.difficulty || 'Beginner',
      askedAt: new Date().toISOString(),
      snippet: first.snippet ?? null,
      thinkSeconds: first.thinkSeconds ?? 0,
      ragChunkIds: first.ragChunkIds || [],
      aiFallback: first.aiFallback || undefined,
    };
    const transcript: LiveInterviewTurn[] = [
      { role: 'ai', text: first.text, at: new Date().toISOString(), questionNumber: 1 },
    ];
    return this.lockInterview(interview.id, async (row, tx) => {
      // Started (or ended) by a concurrent request on another instance: keep its first question.
      if (row.startAt || row.status === 'COMPLETED') return this.toSession(row);
      const updated = await tx.interview.update({
        where: { id: row.id },
        data: {
          startAt: new Date(),
          questionsJson: JSON.stringify([question]),
          transcriptJson: JSON.stringify(transcript),
          questionIndex: 0,
          status: 'IN_PROGRESS',
        },
      });
      return this.toSession(updated);
    });
  }

  async answerLive(
    userId: string,
    id: string,
    answer: string,
    durationSec = 0,
    answerMode: 'TEXT' | 'AUDIO' = 'TEXT',
    expectedIndex?: number,
  ) {
    const interview = await this.requireInterview(userId, id);
    if (interview.status === 'COMPLETED') throw interviewEnded();
    if (expectedIndex != null && expectedIndex !== interview.questionIndex) throw alreadyAnswered();
    const trimmed = answer.trim();
    const isAudioOnly =
      answerMode === 'AUDIO' || (!trimmed && durationSec > 0) || isAudioPlaceholderAnswer(trimmed);
    const conduct = isAudioOnly ? null : detectConduct(trimmed);
    if (conduct) return this.handleConduct(userId, interview.id, conduct, trimmed, durationSec);

    const textAnswer = isAudioOnly ? '' : trimmed;
    // Claim the open question under a row lock so a duplicate/concurrent submit can't answer it
    // twice or trigger a second next-question generation.
    const claim = await this.lockInterview(interview.id, async (row, tx) => {
      if (row.status === 'COMPLETED') throw interviewEnded();
      const questions = parseQuestions(row.questionsJson);
      const current = questions[row.questionIndex];
      if (!current) {
        throw new BadRequestException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message: 'There is no open question to answer.' });
      }
      if (isAnsweredQuestion(current) || (expectedIndex != null && expectedIndex !== row.questionIndex)) {
        throw alreadyAnswered();
      }
      current.answer = textAnswer;
      current.answerMode = isAudioOnly ? 'AUDIO' : 'TEXT';
      current.answeredAt = new Date().toISOString();
      current.answerDurationSec = durationSec;
      current.analysis = SCORING_PLACEHOLDER;
      current.improvedAnswer = undefined;
      current.score = undefined;
      current.strengths = [];
      current.weaknesses = [];
      current.whatWasGood = [];
      current.whatWasMissing = [];
      current.improvementSuggestion = undefined;
      const transcript = parseTurns(row.transcriptJson || '[]');
      transcript.push({
        role: 'candidate',
        text: isAudioOnly ? '[Audio answer]' : textAnswer,
        at: new Date().toISOString(),
        questionNumber: current.number,
      });
      const updated = await tx.interview.update({
        where: { id: row.id },
        data: {
          questionsJson: JSON.stringify(questions),
          answersJson: JSON.stringify(questions.map((item) => item.answer || '')),
          transcriptJson: JSON.stringify(transcript),
        },
      });
      return { row: updated, questions, current };
    });

    const { row, questions, current } = claim;
    const profile = this.profileOf(row);
    this.scheduleAnswerScore(row.id, current.id, profile, current.text, textAnswer, {
      answerMode: isAudioOnly ? 'AUDIO' : 'TEXT',
      durationSec,
      category: current.category,
    });

    return this.advanceLive(userId, id, row, questions, current, isAudioOnly ? 'Audio answer submitted.' : textAnswer);
  }

  /** Close the open question as skipped (score 0, no AI evaluation) and move to the next one. */
  async skipLive(userId: string, id: string, expectedIndex?: number) {
    const interview = await this.requireInterview(userId, id);
    if (interview.mode !== 'LIVE_AI') {
      throw new BadRequestException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message: 'This interview is not an AI live session.' });
    }
    if (interview.status === 'COMPLETED') throw interviewEnded();
    if (expectedIndex != null && expectedIndex !== interview.questionIndex) throw alreadyAnswered();
    const claim = await this.lockInterview(interview.id, async (row, tx) => {
      if (row.status === 'COMPLETED') throw interviewEnded();
      const questions = parseQuestions(row.questionsJson);
      const current = questions[row.questionIndex];
      if (!current) {
        throw new BadRequestException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message: 'There is no open question to skip.' });
      }
      if (isAnsweredQuestion(current) || (expectedIndex != null && expectedIndex !== row.questionIndex)) {
        throw alreadyAnswered();
      }
      Object.assign(current, skippedQuestionResult());
      const transcript = parseTurns(row.transcriptJson || '[]');
      transcript.push({ role: 'candidate', text: '[Skipped]', at: new Date().toISOString(), questionNumber: current.number });
      const updated = await tx.interview.update({
        where: { id: row.id },
        data: {
          questionsJson: JSON.stringify(questions),
          answersJson: JSON.stringify(questions.map((item) => item.answer || '')),
          transcriptJson: JSON.stringify(transcript),
        },
      });
      return { row: updated, questions, current };
    });
    return this.advanceLive(userId, id, claim.row, claim.questions, claim.current, 'Question skipped.');
  }

  private async advanceLive(
    userId: string,
    id: string,
    row: Interview,
    questions: LiveInterviewQuestion[],
    current: LiveInterviewQuestion,
    lastAnswer: string,
  ) {
    const profile = this.profileOf(row);
    const limitMin = row.durationLimitMin || 30;
    const elapsed = row.startAt ? (Date.now() - row.startAt.getTime()) / 60000 : 0;
    const questionLimit = readQuestionLimit(row.profileJson);
    if (elapsed >= limitMin || countAnsweredQuestions(questions) >= questionLimit) {
      return this.endLive(userId, id);
    }

    const follow = await this.ai.nextQuestion(
      profile,
      row.interviewType,
      row.difficulty || 'Beginner',
      questions.map((item) => item.text),
      { question: current.text, answer: lastAnswer },
      (questions as StoredLiveQuestion[]).flatMap((item) => item.ragChunkIds || []),
    );

    return this.lockInterview(row.id, async (fresh, tx) => {
      const latest = parseQuestions(fresh.questionsJson);
      // Interview ended meanwhile, or the answered question is no longer the latest one.
      if (fresh.status === 'COMPLETED' || latest[latest.length - 1]?.id !== current.id) {
        return this.toSession(fresh);
      }
      const nextQuestion: StoredLiveQuestion = {
        id: crypto.randomUUID(),
        number: latest.length + 1,
        text: follow.text,
        category: follow.category,
        difficulty: fresh.difficulty || 'Beginner',
        askedAt: new Date().toISOString(),
        snippet: follow.snippet ?? null,
        thinkSeconds: follow.thinkSeconds ?? 0,
        ragChunkIds: follow.ragChunkIds || [],
        aiFallback: follow.aiFallback || undefined,
      };
      latest.push(nextQuestion);
      const transcript = parseTurns(fresh.transcriptJson || '[]');
      transcript.push({
        role: 'ai',
        text: follow.text,
        at: new Date().toISOString(),
        questionNumber: nextQuestion.number,
      });
      const updated = await tx.interview.update({
        where: { id: fresh.id },
        data: {
          questionsJson: JSON.stringify(latest),
          answersJson: JSON.stringify(latest.map((item) => item.answer || '')),
          transcriptJson: JSON.stringify(transcript),
          questionIndex: latest.length - 1,
        },
      });
      return this.toSession(updated);
    });
  }

  private async handleConduct(
    userId: string,
    interviewId: string,
    conduct: NonNullable<ReturnType<typeof detectConduct>>,
    trimmed: string,
    durationSec: number,
  ) {
    const outcome = await this.lockInterview(interviewId, async (row, tx) => {
      if (row.status === 'COMPLETED') throw interviewEnded();
      const warnings = parseWarnings(row.warningsJson);
      // Count same-kind strikes so 3 abusive answers end the interview.
      const prior = countConductWarnings(warnings, conduct);
      const type = conduct === 'abuse' ? 'ABUSE' : 'NONSENSE';
      if (prior < CONDUCT_MAX_WARNINGS) {
        const message = conductWarningMessage(conduct, prior + 1);
        warnings.push({ type, message, severity: 'HIGH', at: new Date().toISOString() });
        const updated = await tx.interview.update({
          where: { id: row.id },
          data: { warningsJson: JSON.stringify(warnings.slice(-40)) },
        });
        return { terminated: false as const, message, updated };
      }
      const questions = parseQuestions(row.questionsJson);
      const current = questions[row.questionIndex];
      if (current && !isAnsweredQuestion(current)) {
        current.answer = trimmed;
        current.answeredAt = new Date().toISOString();
        current.answerDurationSec = durationSec;
        current.score = 0;
        current.analysis =
          conduct === 'abuse'
            ? 'Interview ended after repeated abusive language. Behaviour scored as unprofessional.'
            : 'Interview ended due to repeated inappropriate or meaningless responses.';
        current.improvedAnswer = 'I will answer professionally without abusive or meaningless language.';
        current.strengths = [];
        current.weaknesses =
          conduct === 'abuse' ? ['Used abusive language after two warnings'] : ['Repeated conduct issue after warnings'];
      }
      const message = conductTerminateMessage(conduct);
      warnings.push({ type, message, severity: 'HIGH', at: new Date().toISOString() });
      await tx.interview.update({
        where: { id: row.id },
        data: { questionsJson: JSON.stringify(questions), warningsJson: JSON.stringify(warnings.slice(-40)) },
      });
      return { terminated: true as const, message };
    });
    if (!outcome.terminated) return { ...this.toSession(outcome.updated), conductWarning: outcome.message };
    const ended = await this.endLive(userId, interviewId);
    return { ...ended, conductWarning: outcome.message, conductTerminated: true };
  }

  /** Serialize read-modify-write of an interview's JSON columns across requests and instances. */
  private lockInterview<T>(id: string, fn: (row: Interview, tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM interviews WHERE id = ${id} FOR UPDATE`;
      const row = await tx.interview.findUniqueOrThrow({ where: { id } });
      return fn(row, tx);
    });
  }

  /** Queue Gemini evaluation without blocking the submit response. */
  private scheduleAnswerScore(
    interviewId: string,
    questionId: string,
    profile: InterviewProfile,
    questionText: string,
    textAnswer: string,
    options: AnswerScoreOptions,
  ) {
    const prev = this.pendingScores.get(interviewId) || Promise.resolve();
    const next = prev
      .then(() =>
        this.applyAnswerScoreInBackground(interviewId, questionId, profile, questionText, textAnswer, options),
      )
      .catch((err: unknown) => {
        this.logger.warn(
          `Deferred answer score failed for interview ${interviewId} question ${questionId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    this.pendingScores.set(interviewId, next);
    void next.finally(() => {
      if (this.pendingScores.get(interviewId) === next) {
        this.pendingScores.delete(interviewId);
      }
    });
  }

  private async awaitPendingScores(interviewId: string) {
    const pending = this.pendingScores.get(interviewId);
    if (pending) await pending;
  }

  private async applyAnswerScoreInBackground(
    interviewId: string,
    questionId: string,
    profile: InterviewProfile,
    questionText: string,
    textAnswer: string,
    options: AnswerScoreOptions,
  ) {
    const analysis = await this.ai.analyzeAnswer(profile, questionText, textAnswer, options);
    await this.applyAnalyses(interviewId, new Map([[questionId, analysis]]));
  }

  /** Write per-question analyses under the row lock, only onto questions still awaiting a score. */
  private applyAnalyses(interviewId: string, analyses: Map<string, AnswerAnalysis>) {
    return this.lockInterview(interviewId, async (row, tx) => {
      const questions = parseQuestions(row.questionsJson);
      // Don't overwrite a finished report's question payload after completion.
      if (row.status === 'COMPLETED' && row.reportJson) return questions;
      let changed = false;
      for (const target of questions) {
        const analysis = analyses.get(target.id);
        if (!analysis || !isPendingScore(target)) continue;
        target.analysis = analysis.analysis;
        target.improvedAnswer = analysis.improvedAnswer || undefined;
        target.score = analysis.score;
        target.strengths = analysis.strengths;
        target.weaknesses = analysis.weaknesses;
        target.whatWasGood = analysis.whatWasGood;
        target.whatWasMissing = analysis.whatWasMissing;
        target.improvementSuggestion = analysis.improvementSuggestion;
        target.scoredWithoutAi = analysis.scoredWithoutAi || undefined;
        changed = true;
      }
      if (changed) {
        await tx.interview.update({ where: { id: row.id }, data: { questionsJson: JSON.stringify(questions) } });
      }
      return questions;
    });
  }

  async addWarning(userId: string, id: string, warning: Omit<InterviewWarning, 'at'> & { at?: string }) {
    const interview = await this.requireInterview(userId, id);
    return this.lockInterview(interview.id, async (row, tx) => {
      const warnings = parseWarnings(row.warningsJson);
      warnings.push({
        type: warning.type,
        message: warning.message,
        severity: warning.severity,
        at: warning.at || new Date().toISOString(),
      });
      const updated = await tx.interview.update({
        where: { id: row.id },
        data: { warningsJson: JSON.stringify(warnings.slice(-40)) },
      });
      return this.toSession(updated);
    });
  }

  async endLive(userId: string, id: string) {
    const interview = await this.requireInterview(userId, id);
    if (interview.mode !== 'LIVE_AI') {
      throw new BadRequestException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message: 'This interview is not an AI live session.' });
    }
    if (interview.status === 'COMPLETED' && interview.reportJson) return this.toSession(interview);
    // Concurrent end requests (timer + button + last answer) share one report generation.
    const inflight = this.endInflight.get(interview.id);
    if (inflight) return inflight;
    const run = this.finishLive(userId, interview.id).finally(() => this.endInflight.delete(interview.id));
    this.endInflight.set(interview.id, run);
    return run;
  }

  private async finishLive(userId: string, interviewId: string) {
    // Finish any deferred per-answer scores before building the final report.
    await this.awaitPendingScores(interviewId);
    const latest = await this.prisma.interview.findUniqueOrThrow({ where: { id: interviewId } });
    if (latest.status === 'COMPLETED' && latest.reportJson) return this.toSession(latest);

    const endAt = new Date();
    const startAt = latest.startAt || latest.createdAt;
    const durationSec = Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 1000));
    const warnings = parseWarnings(latest.warningsJson);
    const profile = this.profileOf(latest);
    const questions = await this.ensureQuestionsScored(latest.id, parseQuestions(latest.questionsJson), profile);
    const integrity = {
      tabSwitches: warnings.filter((item) => item.type === 'TAB_SWITCH').length,
      faceMissing: warnings.filter((item) => item.type === 'FACE_MISSING').length,
      multipleFaces: warnings.filter((item) => item.type === 'MULTIPLE_FACES').length,
      micIssues: warnings.filter((item) => item.type === 'MIC').length,
      abuseWarnings: warnings.filter((item) => item.type === 'ABUSE').length,
      nonsenseWarnings: warnings.filter((item) => item.type === 'NONSENSE').length,
    };
    const report = await this.ai.report(
      profile,
      questions,
      durationSec,
      integrity,
      readQuestionLimit(latest.profileJson),
    );
    const finished = await this.lockInterview(latest.id, async (row, tx) => {
      // Another request/instance already finalized this interview: keep its report.
      if (row.status === 'COMPLETED' && row.reportJson) return { row, completedNow: false };
      const updated = await tx.interview.update({
        where: { id: row.id },
        data: {
          status: 'COMPLETED',
          endAt,
          durationSec,
          score: report.overallScore,
          communicationScore: report.communication,
          behaviourScore: report.behaviour,
          listeningScore: report.listening,
          reportJson: JSON.stringify(report),
          feedbackJson: JSON.stringify({
            score: report.overallScore,
            communication: report.communication * 10,
            structure: report.behaviour * 10,
            relevance: report.listening * 10,
            confidence: report.communication * 10,
            strengths: report.strengths,
            improvements: report.weaknesses,
          }),
        },
      });
      return { row: updated, completedNow: true };
    });
    if (finished.completedNow) {
      await this.testimonials
        .markEligible(userId, 'AFTER_FIRST_MOCK_INTERVIEW')
        .catch(() => undefined);
    }
    return this.toSession(finished.row);
  }

  /** Score any answered questions still pending (background miss / process restart). */
  private async ensureQuestionsScored(
    interviewId: string,
    questions: LiveInterviewQuestion[],
    profile: InterviewProfile,
  ) {
    const analyses = new Map<string, AnswerAnalysis>();
    for (const item of questions) {
      if (!isAnsweredQuestion(item) || !isPendingScore(item)) continue;
      const textAnswer = item.answerMode === 'AUDIO' ? '' : (item.answer || '').trim();
      analyses.set(
        item.id,
        await this.ai.analyzeAnswer(profile, item.text, textAnswer, {
          answerMode: item.answerMode === 'AUDIO' ? 'AUDIO' : 'TEXT',
          durationSec: item.answerDurationSec || 0,
          category: item.category,
        }),
      );
    }
    if (!analyses.size) return questions;
    return this.applyAnalyses(interviewId, analyses);
  }

  async downloadReport(userId: string, id: string) {
    const session = await this.get(userId, id);
    const pdf = await renderInterviewPdf(session);
    return {
      pdf: pdf.toString('base64'),
      fileName: `interview-report-${session.jobRole.replace(/\s+/g, '-')}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  async get(userId: string, id: string) {
    return this.toSession(await this.requireInterview(userId, id));
  }

  async respond(userId: string, id: string, answer: string) {
    const interview = await this.requireInterview(userId, id);
    if (interview.mode === 'LIVE_AI') return this.answerLive(userId, id, answer);
    const questions = parseStringArray(interview.questionsJson);
    const answers = parseStringArray(interview.answersJson);
    answers[interview.questionIndex] = answer;
    const nextIndex = interview.questionIndex + 1;
    const completed = nextIndex >= questions.length;
    const feedback = completed ? this.intelligence.scoreInterview(answers) : null;
    const updated = await this.prisma.interview.update({
      where: { id: interview.id },
      data: {
        answersJson: JSON.stringify(answers),
        questionIndex: completed ? interview.questionIndex : nextIndex,
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        score: feedback?.score,
        feedbackJson: feedback ? JSON.stringify(feedback) : interview.feedbackJson,
      },
    });
    return this.toSession(updated);
  }

  private profileOf(interview: { id: string; profileJson: string | null; jobRole: string }): InterviewProfile {
    const content = parseJson<
      Partial<ResumeContent> & {
        experienceYears?: number;
        questionLimit?: number;
        requestedDifficulty?: string;
        candidateId?: string;
        resumeId?: string;
      }
    >(interview.profileJson, {});
    const profile = profileFromResume(
      {
        fullName: content.fullName || 'Candidate',
        city: content.city || null,
        phone: content.phone || null,
        summary: content.summary || '',
        skills: content.skills || [],
        education: content.education || [],
        experiences: content.experiences || [],
        languages: content.languages || [],
        certifications: content.certifications || [],
        projects: content.projects || [],
        experienceYears: content.experienceYears || 0,
      } as ResumeContent & { experienceYears?: number },
      interview.jobRole,
    );
    return {
      ...profile,
      questionLimit: content.questionLimit,
      requestedDifficulty: content.requestedDifficulty,
      candidateId: content.candidateId,
      resumeId: content.resumeId,
      interviewId: interview.id,
    };
  }

  private async requireCandidate(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    return candidate;
  }

  private async requireInterview(userId: string, id: string) {
    const candidate = await this.requireCandidate(userId);
    const interview = await this.prisma.interview.findFirst({ where: { id, candidateId: candidate.id } });
    if (!interview) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Interview was not found' });
    }
    return interview;
  }

  private toSession(row: {
    id: string;
    jobRole: string;
    interviewType: string;
    status: string;
    questionIndex: number;
    questionsJson: string;
    score: number | null;
    feedbackJson: string | null;
    mode?: string;
    source?: string | null;
    startAt?: Date | null;
    endAt?: Date | null;
    durationSec?: number | null;
    durationLimitMin?: number | null;
    difficulty?: string | null;
    profileJson?: string | null;
    transcriptJson?: string | null;
    warningsJson?: string | null;
    reportJson?: string | null;
    communicationScore?: number | null;
    behaviourScore?: number | null;
    listeningScore?: number | null;
  }): InterviewSession {
    const liveQuestions = parseQuestions(row.questionsJson);
    const classic = liveQuestions.length === 0 ? parseStringArray(row.questionsJson) : [];
    const completed = row.status === 'COMPLETED';
    const currentLive = liveQuestions[row.questionIndex];
    const profile = parseJson<Partial<ResumeContent>>(row.profileJson || null, {});
    const focusStacks = profileFromResume(
      {
        fullName: profile.fullName || 'Candidate',
        city: profile.city || null,
        phone: profile.phone || null,
        summary: profile.summary || '',
        skills: profile.skills || [],
        education: profile.education || [],
        experiences: profile.experiences || [],
        languages: profile.languages || [],
        certifications: profile.certifications || [],
        projects: profile.projects || [],
      },
      row.jobRole,
    ).focusStacks;
    return {
      id: row.id,
      jobRole: row.jobRole,
      interviewType: row.interviewType,
      status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      questionIndex: row.questionIndex,
      totalQuestions:
        row.mode === 'LIVE_AI'
          ? readQuestionLimit(row.profileJson || null)
          : liveQuestions.length || classic.length || 8,
      currentQuestion: completed
        ? null
        : currentLive && !isAnsweredQuestion(currentLive)
          ? {
              index: row.questionIndex,
              prompt: currentLive.text,
              snippet: currentLive.snippet ?? null,
              thinkSeconds: currentLive.thinkSeconds ?? 0,
              aiFallback: currentLive.aiFallback || undefined,
            }
          : classic[row.questionIndex]
            ? { index: row.questionIndex, prompt: classic[row.questionIndex] }
            : null,
      score: row.score,
      feedback: row.feedbackJson ? (JSON.parse(row.feedbackJson) as InterviewSession['feedback']) : null,
      mode: (row.mode as InterviewSession['mode']) || 'CLASSIC',
      source: (row.source as InterviewSession['source']) || null,
      startAt: row.startAt?.toISOString() || null,
      endAt: row.endAt?.toISOString() || null,
      durationSec: row.durationSec ?? null,
      durationLimitMin: row.durationLimitMin ?? null,
      difficulty: row.difficulty ?? null,
      candidateName: profile.fullName || null,
      focusStacks,
      transcript: parseTurns(row.transcriptJson || '[]'),
      liveQuestions: liveQuestions.map(({ ragChunkIds: _internal, ...item }: StoredLiveQuestion) => item),
      warnings: parseWarnings(row.warningsJson || '[]'),
      report: row.reportJson ? (JSON.parse(row.reportJson) as InterviewReport) : null,
      communicationScore: row.communicationScore ?? null,
      behaviourScore: row.behaviourScore ?? null,
      listeningScore: row.listeningScore ?? null,
    };
  }
}

function passportContent(candidate: {
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  about: string | null;
  certifications: string;
  projects: string;
  skills: Array<{ name: string }>;
  education: Array<{ qualification: string; institution: string | null }>;
  experiences: Array<{ company: string; jobTitle: string; description: string | null }>;
  resumes: Array<{ contentJson: string }>;
}): ResumeContent {
  const base = contentFromCandidate(candidate);
  const fromResume = parseJson<Partial<ResumeContent>>(candidate.resumes[0]?.contentJson || null, {});
  const certs = parseJson<Array<{ name?: string } | string>>(candidate.certifications, []);
  const projects = parseJson<Array<{ title?: string; name?: string; description?: string | null }>>(candidate.projects, []);
  const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  return {
    ...base,
    summary: fromResume.summary || base.summary,
    skills: unique([...base.skills, ...(fromResume.skills || [])]),
    education: base.education.length ? base.education : fromResume.education || [],
    experiences: base.experiences.length ? base.experiences : fromResume.experiences || [],
    certifications: unique([
      ...(fromResume.certifications || []).map((item) =>
        typeof item === 'string' ? item : [item.name, item.issuer, item.date].filter(Boolean).join(' — '),
      ),
      ...certs.map((item) => (typeof item === 'string' ? item : item.name || '')),
    ]),
    projects: [
      ...(fromResume.projects || []),
      ...projects.map((item) => ({
        name: item.title || item.name || 'Project',
        description: item.description || null,
      })),
    ],
  };
}

function contentFromCandidate(candidate: {
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  about: string | null;
  skills: Array<{ name: string }>;
  education: Array<{ qualification: string; institution: string | null }>;
  experiences: Array<{ company: string; jobTitle: string; description: string | null }>;
}): ResumeContent {
  return {
    fullName: [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'Candidate',
    city: candidate.city,
    phone: null,
    summary: candidate.about || '',
    skills: candidate.skills.map((item) => item.name),
    education: candidate.education.map((item) => ({
      qualification: item.qualification,
      institution: item.institution,
      yearCompleted: null,
    })),
    experiences: candidate.experiences.map((item) => ({
      company: item.company,
      jobTitle: item.jobTitle,
      description: item.description,
      isInternship: false,
    })),
    languages: [],
  };
}

function parseStringArray(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseQuestions(raw: string): LiveInterviewQuestion[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value) || !value.length) return [];
    if (typeof value[0] === 'string') return [];
    return value as LiveInterviewQuestion[];
  } catch {
    return [];
  }
}

function parseTurns(raw: string): LiveInterviewTurn[] {
  try {
    const value = JSON.parse(raw) as LiveInterviewTurn[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parseWarnings(raw: string): InterviewWarning[] {
  try {
    const value = JSON.parse(raw) as InterviewWarning[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const SETUP_DIFFICULTIES = new Set(['Beginner', 'Intermediate', 'Advanced']);

export function skippedQuestionResult(now = new Date()): Partial<LiveInterviewQuestion> {
  return {
    answer: '',
    answerMode: 'SKIPPED',
    answeredAt: now.toISOString(),
    answerDurationSec: 0,
    score: 0,
    analysis: 'Question skipped — no answer was given.',
    improvedAnswer: undefined,
    strengths: [],
    weaknesses: ['Question was skipped'],
    whatWasGood: [],
    whatWasMissing: ['An answer to this question'],
    improvementSuggestion: 'Practise this question and give a specific example from your experience.',
  };
}

function clampQuestionLimit(value: number) {
  return Math.min(15, Math.max(3, Math.round(value)));
}

function readQuestionLimit(profileJson: string | null) {
  const parsed = parseJson<{ questionLimit?: number }>(profileJson, {});
  if (!parsed.questionLimit) return 15;
  return clampQuestionLimit(parsed.questionLimit);
}

function normalizeInterviewType(value: string) {
  const kind = (value || 'MIXED').toUpperCase();
  if (kind === 'GENERIC') return 'BEHAVIOURAL';
  if (kind === 'ROLE_BASED') return 'ROLE';
  return kind;
}
