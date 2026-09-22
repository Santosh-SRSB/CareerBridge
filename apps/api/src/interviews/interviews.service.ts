import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  type InterviewReport,
  type InterviewSession,
  type InterviewWarning,
  type LiveInterviewQuestion,
  type LiveInterviewTurn,
  type ResumeContent,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);
  /** Chains deferred Gemini scoring so endLive waits and concurrent writes don't clobber. */
  private readonly pendingScores = new Map<string, Promise<void>>();

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
      include: { skills: true, education: true, experiences: true, resumes: { orderBy: { updatedAt: 'desc' }, take: 1 } },
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
        profileJson: JSON.stringify({ ...content, experienceYears: years, questionLimit, candidateId: candidate.id }),
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
    const profile = this.profileOf(interview);
    const first = await this.ai.firstQuestion(profile, interview.interviewType);
    const question: LiveInterviewQuestion = {
      id: crypto.randomUUID(),
      number: 1,
      text: first.text,
      category: first.category,
      difficulty: interview.difficulty || 'Beginner',
      askedAt: new Date().toISOString(),
      snippet: first.snippet ?? null,
      thinkSeconds: first.thinkSeconds ?? 0,
    };
    const transcript: LiveInterviewTurn[] = [
      { role: 'ai', text: first.text, at: new Date().toISOString(), questionNumber: 1 },
    ];
    const updated = await this.prisma.interview.update({
      where: { id: interview.id },
      data: {
        startAt: new Date(),
        questionsJson: JSON.stringify([question]),
        transcriptJson: JSON.stringify(transcript),
        questionIndex: 0,
        status: 'IN_PROGRESS',
      },
    });
    return this.toSession(updated);
  }

  async answerLive(
    userId: string,
    id: string,
    answer: string,
    durationSec = 0,
    answerMode: 'TEXT' | 'AUDIO' = 'TEXT',
  ) {
    const interview = await this.requireInterview(userId, id);
    if (interview.status === 'COMPLETED') {
      throw new BadRequestException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message: 'This interview has already ended.' });
    }
    const trimmed = answer.trim();
    const isAudioOnlyEarly =
      answerMode === 'AUDIO' || (!trimmed && durationSec > 0) || isAudioPlaceholderAnswer(trimmed);
    const warnings = parseWarnings(interview.warningsJson);
    const conduct = isAudioOnlyEarly ? null : detectConduct(trimmed);
    if (conduct) {
      // Count same-kind strikes so 3 abusive answers end the interview.
      const prior = countConductWarnings(warnings, conduct);
      const strike = prior + 1;
      if (prior >= CONDUCT_MAX_WARNINGS) {
        const questions = parseQuestions(interview.questionsJson);
        const current = questions[interview.questionIndex];
        if (current && !current.answer) {
          current.answer = trimmed;
          current.answeredAt = new Date().toISOString();
          current.answerDurationSec = durationSec;
          current.score = 0;
          current.analysis =
            conduct === 'abuse'
              ? 'Interview ended after repeated abusive language. Behaviour scored as unprofessional.'
              : 'Interview ended due to repeated inappropriate or meaningless responses.';
          current.improvedAnswer =
            'I will answer professionally without abusive or meaningless language.';
          current.strengths = [];
          current.weaknesses =
            conduct === 'abuse'
              ? ['Used abusive language after two warnings']
              : ['Repeated conduct issue after warnings'];
          await this.prisma.interview.update({
            where: { id: interview.id },
            data: { questionsJson: JSON.stringify(questions) },
          });
        }
        const terminateMsg = conductTerminateMessage(conduct);
        warnings.push({
          type: conduct === 'abuse' ? 'ABUSE' : 'NONSENSE',
          message: terminateMsg,
          severity: 'HIGH',
          at: new Date().toISOString(),
        });
        await this.prisma.interview.update({
          where: { id: interview.id },
          data: { warningsJson: JSON.stringify(warnings.slice(-40)) },
        });
        const ended = await this.endLive(userId, id);
        return { ...ended, conductWarning: terminateMsg, conductTerminated: true };
      }
      const warnMsg = conductWarningMessage(conduct, strike);
      warnings.push({
        type: conduct === 'abuse' ? 'ABUSE' : 'NONSENSE',
        message: warnMsg,
        severity: 'HIGH',
        at: new Date().toISOString(),
      });
      const updated = await this.prisma.interview.update({
        where: { id: interview.id },
        data: { warningsJson: JSON.stringify(warnings.slice(-40)) },
      });
      return { ...this.toSession(updated), conductWarning: warnMsg };
    }

    const questions = parseQuestions(interview.questionsJson);
    const current = questions[interview.questionIndex];
    if (!current || isAnsweredQuestion(current)) {
      throw new BadRequestException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message: 'There is no open question to answer.' });
    }
    const profile = this.profileOf(interview);
    const isAudioOnly = isAudioOnlyEarly;
    const textAnswer = isAudioOnly ? '' : trimmed;
    // Persist answer immediately; Gemini scoring runs in the background so Submit
    // only waits on next-question generation (not evaluate + next question).
    current.answer = textAnswer;
    current.answerMode = isAudioOnly ? 'AUDIO' : 'TEXT';
    current.answeredAt = new Date().toISOString();
    current.answerDurationSec = durationSec;
    current.analysis = 'Scoring in progress…';
    current.improvedAnswer = undefined;
    current.score = undefined;
    current.strengths = [];
    current.weaknesses = [];
    current.whatWasGood = [];
    current.whatWasMissing = [];
    current.improvementSuggestion = undefined;
    const questionId = current.id;
    const questionText = current.text;
    const transcript = parseTurns(interview.transcriptJson);
    transcript.push({
      role: 'candidate',
      text: isAudioOnly ? '[Audio answer]' : textAnswer,
      at: new Date().toISOString(),
      questionNumber: current.number,
    });

    const limitMin = interview.durationLimitMin || 30;
    const elapsed = interview.startAt ? (Date.now() - interview.startAt.getTime()) / 60000 : 0;
    const questionLimit = readQuestionLimit(interview.profileJson);
    const answeredAfter = countAnsweredQuestions(questions);
    const asked = questions.map((item) => item.text);
    let nextQuestion: LiveInterviewQuestion | null = null;
    if (elapsed < limitMin && answeredAfter < questionLimit) {
      const follow = await this.ai.nextQuestion(
        profile,
        interview.interviewType,
        interview.difficulty || 'Beginner',
        asked,
        { question: current.text, answer: isAudioOnly ? 'Audio answer submitted.' : textAnswer },
      );
      nextQuestion = {
        id: crypto.randomUUID(),
        number: questions.length + 1,
        text: follow.text,
        category: follow.category,
        difficulty: interview.difficulty || 'Beginner',
        askedAt: new Date().toISOString(),
        snippet: follow.snippet ?? null,
        thinkSeconds: follow.thinkSeconds ?? 0,
      };
      questions.push(nextQuestion);
      transcript.push({
        role: 'ai',
        text: follow.text,
        at: new Date().toISOString(),
        questionNumber: nextQuestion.number,
      });
    }

    const updated = await this.prisma.interview.update({
      where: { id: interview.id },
      data: {
        questionsJson: JSON.stringify(questions),
        answersJson: JSON.stringify(questions.map((item) => item.answer || '')),
        transcriptJson: JSON.stringify(transcript),
        questionIndex: nextQuestion ? questions.length - 1 : interview.questionIndex,
      },
    });

    this.scheduleAnswerScore(interview.id, questionId, profile, questionText, textAnswer, {
      answerMode: isAudioOnly ? 'AUDIO' : 'TEXT',
      durationSec,
    });

    if (!nextQuestion) return this.endLive(userId, id);
    return this.toSession(updated);
  }

  /** Queue Gemini evaluation without blocking the submit response. */
  private scheduleAnswerScore(
    interviewId: string,
    questionId: string,
    profile: InterviewProfile,
    questionText: string,
    textAnswer: string,
    options: { answerMode: 'TEXT' | 'AUDIO'; durationSec: number },
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
    options: { answerMode: 'TEXT' | 'AUDIO'; durationSec: number },
  ) {
    const analysis = await this.ai.analyzeAnswer(profile, questionText, textAnswer, options);
    const row = await this.prisma.interview.findUnique({ where: { id: interviewId } });
    if (!row) return;
    // Don't overwrite a finished report's question payload after completion.
    if (row.status === 'COMPLETED' && row.reportJson) return;

    const questions = parseQuestions(row.questionsJson);
    const target = questions.find((item) => item.id === questionId);
    if (!target) return;

    target.analysis = analysis.analysis;
    target.improvedAnswer = analysis.improvedAnswer || undefined;
    target.score = analysis.score;
    target.strengths = analysis.strengths;
    target.weaknesses = analysis.weaknesses;
    target.whatWasGood = analysis.whatWasGood;
    target.whatWasMissing = analysis.whatWasMissing;
    target.improvementSuggestion = analysis.improvementSuggestion;

    await this.prisma.interview.update({
      where: { id: interviewId },
      data: { questionsJson: JSON.stringify(questions) },
    });
  }

  async addWarning(userId: string, id: string, warning: Omit<InterviewWarning, 'at'> & { at?: string }) {
    const interview = await this.requireInterview(userId, id);
    const warnings = parseWarnings(interview.warningsJson);
    warnings.push({
      type: warning.type,
      message: warning.message,
      severity: warning.severity,
      at: warning.at || new Date().toISOString(),
    });
    const updated = await this.prisma.interview.update({
      where: { id: interview.id },
      data: { warningsJson: JSON.stringify(warnings.slice(-40)) },
    });
    return this.toSession(updated);
  }

  async endLive(userId: string, id: string) {
    const interview = await this.requireInterview(userId, id);
    if (interview.mode !== 'LIVE_AI') {
      throw new BadRequestException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message: 'This interview is not an AI live session.' });
    }
    if (interview.status === 'COMPLETED' && interview.reportJson) return this.toSession(interview);
    // Finish any deferred per-answer scores before building the final report.
    await this.awaitPendingScores(interview.id);
    const fresh = await this.prisma.interview.findUnique({ where: { id: interview.id } });
    const latest = fresh || interview;
    if (latest.status === 'COMPLETED' && latest.reportJson) return this.toSession(latest);

    const endAt = new Date();
    const startAt = latest.startAt || latest.createdAt;
    const durationSec = Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 1000));
    const questions = parseQuestions(latest.questionsJson);
    const warnings = parseWarnings(latest.warningsJson);
    const profile = this.profileOf(latest);
    await this.ensureQuestionsScored(latest.id, questions, profile);
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
    const updated = await this.prisma.interview.update({
      where: { id: latest.id },
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
        questionsJson: JSON.stringify(questions),
      },
    });
    await this.testimonials
      .markEligible(userId, 'AFTER_FIRST_MOCK_INTERVIEW')
      .catch(() => undefined);
    return this.toSession(updated);
  }

  /** Score any answered questions still pending (background miss / process restart). */
  private async ensureQuestionsScored(
    interviewId: string,
    questions: LiveInterviewQuestion[],
    profile: InterviewProfile,
  ) {
    let changed = false;
    for (const item of questions) {
      if (!isAnsweredQuestion(item)) continue;
      const pending =
        item.score == null ||
        !item.analysis ||
        item.analysis === 'Scoring in progress…';
      if (!pending) continue;
      const textAnswer = item.answerMode === 'AUDIO' ? '' : (item.answer || '').trim();
      const analysis = await this.ai.analyzeAnswer(profile, item.text, textAnswer, {
        answerMode: item.answerMode === 'AUDIO' ? 'AUDIO' : 'TEXT',
        durationSec: item.answerDurationSec || 0,
      });
      item.analysis = analysis.analysis;
      item.improvedAnswer = analysis.improvedAnswer || undefined;
      item.score = analysis.score;
      item.strengths = analysis.strengths;
      item.weaknesses = analysis.weaknesses;
      item.whatWasGood = analysis.whatWasGood;
      item.whatWasMissing = analysis.whatWasMissing;
      item.improvementSuggestion = analysis.improvementSuggestion;
      changed = true;
    }
    if (changed) {
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: { questionsJson: JSON.stringify(questions) },
      });
    }
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

  private profileOf(interview: { profileJson: string | null; jobRole: string }): InterviewProfile {
    const content = parseJson<
      Partial<ResumeContent> & { experienceYears?: number; questionLimit?: number; candidateId?: string }
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
      candidateId: (content as { candidateId?: string }).candidateId,
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
        : currentLive && !currentLive.answer
          ? {
              index: row.questionIndex,
              prompt: currentLive.text,
              snippet: currentLive.snippet ?? null,
              thinkSeconds: currentLive.thinkSeconds ?? 0,
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
      liveQuestions,
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
