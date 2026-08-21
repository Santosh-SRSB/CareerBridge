import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, type InterviewSession } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
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
      },
    });
    return this.toSession(created);
  }

  async get(userId: string, id: string) {
    return this.toSession(await this.requireInterview(userId, id));
  }

  async respond(userId: string, id: string, answer: string) {
    const interview = await this.requireInterview(userId, id);
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
  }): InterviewSession {
    const questions = parseStringArray(row.questionsJson);
    const completed = row.status === 'COMPLETED';
    return {
      id: row.id,
      jobRole: row.jobRole,
      interviewType: row.interviewType,
      status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      questionIndex: row.questionIndex,
      totalQuestions: questions.length,
      currentQuestion: completed
        ? null
        : { index: row.questionIndex, prompt: questions[row.questionIndex] },
      score: row.score,
      feedback: row.feedbackJson ? (JSON.parse(row.feedbackJson) as InterviewSession['feedback']) : null,
    };
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
