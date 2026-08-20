import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  SKILL_ASSESSMENT_PACK_CREDITS,
  SKILL_ASSESSMENT_PACK_PRICE_INR,
  type SkillAssessmentAccess,
  type SkillAssessmentSession,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  IntelligenceService,
  skillsFromResumeText,
  type StoredSkillAnswer,
  type StoredSkillQuestion,
} from '../intelligence/intelligence.service';
import { analyzeSpokenClip, spokenClipPassed } from './spoken-clip';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
  ) {}

  async list(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.skillAssessment.findMany({
      where: { candidateId: candidate.id },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map(async (row) => this.toSession(await this.rescoreIfNeeded(row))));
  }

  async access(userId: string): Promise<SkillAssessmentAccess> {
    const candidate = await this.requireCandidate(userId);
    const completedCount = await this.prisma.skillAssessment.count({
      where: { candidateId: candidate.id, status: 'COMPLETED' },
    });
    return {
      credits: candidate.assessmentCredits,
      completedCount,
      canStart: candidate.assessmentCredits > 0,
      packCredits: SKILL_ASSESSMENT_PACK_CREDITS,
      packPriceInr: SKILL_ASSESSMENT_PACK_PRICE_INR,
    };
  }

  async start(userId: string) {
    const openCandidate = await this.requireCandidate(userId);
    const open = await this.prisma.skillAssessment.findFirst({
      where: { candidateId: openCandidate.id, status: 'IN_PROGRESS' },
      orderBy: { createdAt: 'desc' },
    });
    if (open) return this.toSession(open);

    if (openCandidate.assessmentCredits < 1) {
      throw new HttpException(
        {
          code: ErrorCode.PAYMENT_REQUIRED,
          message: `Your free skill assessment is used. Unlock ${SKILL_ASSESSMENT_PACK_CREDITS} more for ₹${SKILL_ASSESSMENT_PACK_PRICE_INR}.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: openCandidate.id },
      include: {
        skills: { orderBy: { createdAt: 'asc' } },
        education: true,
        experiences: true,
        resumes: { orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    if (candidate.education.length < 1 || candidate.skills.length < 3) {
      throw new HttpException(
        {
          code: ErrorCode.BUSINESS_RULE_VIOLATION,
          message: 'Complete your Career Passport first. Add at least 1 education record and 3 skills, then start the skill check.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const resume = candidate.resumes[0];
    const resumeContent = parseResumeContent(resume?.contentJson);
    const passportText = [
      resume?.summary,
      resumeContent.summary,
      ...resumeContent.skills,
      ...candidate.skills.map((item) => item.name),
      ...candidate.experiences.map((item) => `${item.jobTitle} ${item.company} ${item.description || ''}`),
      ...candidate.education.map((item) => `${item.qualification} ${item.fieldOfStudy || ''} ${item.institution || ''}`),
    ].join(' ');
    const skillNames = uniqueSkillNames([
      ...candidate.skills.map((item) => item.name),
      ...resumeContent.skills,
      ...skillsFromResumeText(passportText),
    ]);
    const resumeScore = resume?.score || Math.min(100, 48 + skillNames.length * 6 + Math.min(20, candidate.experiences.length * 8));
    const questions = this.intelligence.skillAssessmentQuestions(skillNames, resumeScore);
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { id: candidate.id },
        data: { assessmentCredits: { decrement: 1 } },
      });
      return tx.skillAssessment.create({
        data: {
          candidateId: candidate.id,
          skills: JSON.stringify(skillNames.slice(0, 5)),
          resumeScore,
          questionsJson: JSON.stringify(questions),
        },
      });
    });
    return this.toSession(created);
  }

  async unlock(userId: string) {
    const candidate = await this.requireCandidate(userId);
    await this.prisma.$transaction([
      this.prisma.assessmentPurchase.create({
        data: {
          candidateId: candidate.id,
          credits: SKILL_ASSESSMENT_PACK_CREDITS,
          amountInr: SKILL_ASSESSMENT_PACK_PRICE_INR,
          status: 'PAID',
        },
      }),
      this.prisma.candidate.update({
        where: { id: candidate.id },
        data: { assessmentCredits: { increment: SKILL_ASSESSMENT_PACK_CREDITS } },
      }),
    ]);
    return this.access(userId);
  }

  async get(userId: string, id: string) {
    return this.toSession(await this.rescoreIfNeeded(await this.requireAssessment(userId, id)));
  }

  async respond(
    userId: string,
    id: string,
    payload: { selectedIndex?: number; text?: string; hasAudio?: boolean; hasVoice?: boolean; durationMs?: number },
    recording?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    const row = await this.requireAssessment(userId, id);
    const questions = parseQuestions(row.questionsJson);
    const answers = parseAnswers(row.answersJson);
    const current = questions[row.questionIndex];
    if (!current) return this.toSession(row);

    if (current.kind === 'SPOKEN') {
      const clip = recording?.buffer;
      const analysis = clip?.length ? analyzeSpokenClip(clip, payload.durationMs || 0) : null;
      const hasVoice = Boolean(payload.hasVoice);
      if (!analysis || !spokenClipPassed(analysis, hasVoice)) {
        throw new HttpException(
          {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Record your face and speak clearly for at least 8 seconds. Silence is not an answer.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const score = this.intelligence.scoreSpokenClip({
        text: payload.text?.trim() || '',
        hasVoice,
        ...analysis,
      });
      answers[row.questionIndex] = { score };
    } else {
      const selected = payload.selectedIndex;
      if (selected == null || selected < 0 || selected >= current.options.length) {
        throw new HttpException(
          { code: ErrorCode.VALIDATION_ERROR, message: 'Tick one option, then submit.' },
          HttpStatus.BAD_REQUEST,
        );
      }
      answers[row.questionIndex] = { selectedIndex: selected };
    }

    const nextIndex = row.questionIndex + 1;
    const completed = nextIndex >= questions.length;
    const feedback = completed ? this.intelligence.scoreSkillAssessment(questions, answers) : null;
    const updated = await this.prisma.skillAssessment.update({
      where: { id: row.id },
      data: {
        answersJson: JSON.stringify(answers),
        questionIndex: completed ? row.questionIndex : nextIndex,
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        score: feedback?.score,
        feedbackJson: feedback ? JSON.stringify(feedback) : row.feedbackJson,
      },
    });
    return this.toSession(updated);
  }

  private async rescoreIfNeeded(row: { id: string; status: string; questionsJson: string; answersJson: string; score: number | null; feedbackJson: string | null }) {
    if (row.status !== 'COMPLETED') return row;
    const feedback = this.intelligence.scoreSkillAssessment(parseQuestions(row.questionsJson), parseAnswers(row.answersJson));
    if (feedback.score === row.score) return row;
    return this.prisma.skillAssessment.update({
      where: { id: row.id },
      data: { score: feedback.score, feedbackJson: JSON.stringify(feedback) },
    });
  }

  private async requireCandidate(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    return candidate;
  }

  private async requireAssessment(userId: string, id: string) {
    const candidate = await this.requireCandidate(userId);
    const row = await this.prisma.skillAssessment.findFirst({ where: { id, candidateId: candidate.id } });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Skill assessment was not found' });
    }
    return row;
  }

  private toSession(row: {
    id: string;
    skills: string;
    resumeScore: number;
    status: string;
    questionIndex: number;
    questionsJson: string;
    score: number | null;
    feedbackJson: string | null;
  }): SkillAssessmentSession {
    const questions = parseQuestions(row.questionsJson);
    const completed = row.status === 'COMPLETED';
    const current = questions[row.questionIndex];
    return {
      id: row.id,
      skills: parseStringArray(row.skills),
      resumeScore: row.resumeScore,
      status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      questionIndex: row.questionIndex,
      totalQuestions: questions.length,
      currentQuestion:
        completed || !current
          ? null
          : {
              index: row.questionIndex,
              prompt: current.prompt,
              skill: current.skill,
              kind: current.kind === 'SPOKEN' ? 'SPOKEN' : 'MCQ',
              options: current.options || [],
            },
      score: row.score,
      feedback: row.feedbackJson ? (JSON.parse(row.feedbackJson) as SkillAssessmentSession['feedback']) : null,
    };
  }
}

function parseQuestions(raw: string): StoredSkillQuestion[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value
          .filter(
            (item): item is StoredSkillQuestion =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof (item as StoredSkillQuestion).prompt === 'string',
          )
          .map((item) => ({
            ...item,
            kind: item.kind || (item.options?.length ? 'MCQ' : 'TYPED'),
            options: item.options || [],
          }))
      : [];
  } catch {
    return [];
  }
}

function parseAnswers(raw: string): StoredSkillAnswer[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      if (typeof item === 'number') return { selectedIndex: item };
      if (item && typeof item === 'object') return item as StoredSkillAnswer;
      return {};
    });
  } catch {
    return [];
  }
}

function parseStringArray(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseResumeContent(raw?: string | null) {
  try {
    const value = raw ? (JSON.parse(raw) as { summary?: string; skills?: string[] }) : {};
    return {
      summary: typeof value.summary === 'string' ? value.summary : '',
      skills: Array.isArray(value.skills) ? value.skills.filter((item) => typeof item === 'string') : [],
    };
  } catch {
    return { summary: '', skills: [] as string[] };
  }
}

function uniqueSkillNames(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of values) {
    const name = value?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}
