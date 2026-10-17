import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import {
  ErrorCode,
  HUMAN_INTERVIEW_PRICE_INR,
  humanInterviewerPublicLabel,
  humanInterviewJoinState,
  humanInterviewRoleFromPassport,
  humanInterviewTypeFromRole,
  type HumanInterviewTrack,
  type HumanMockSession,
  type HumanMockStatus,
} from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { EmailService } from '../auth/email.service';
import { clearRoom, putSignal, takeSignal } from './human-mock.signaling';

const INTERNAL_INTERVIEWERS = {
  TECHNICAL: {
    name: 'Harsh Sinha',
    email: 'harshsinha.user2002@gmail.com',
  },
  NON_TECHNICAL: {
    name: 'Priya Kumari',
    email: 'priyakum2120@gmail.com',
  },
} as const;

function resolveInternalInterviewer(track: HumanInterviewTrack) {
  return INTERNAL_INTERVIEWERS[track] || INTERNAL_INTERVIEWERS.NON_TECHNICAL;
}

@Injectable()
export class HumanMocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async list(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const rows = await this.prisma.humanMockInterview.findMany({
      where: { candidateId: candidate.id },
      orderBy: { scheduledAt: 'desc' },
    });
    return rows.map((row) => this.toSession(row));
  }

  async schedule(
    userId: string,
    input: {
      candidateName: string;
      candidateEmail: string;
      scheduledAt: string;
      interviewTrack: HumanInterviewTrack;
    },
  ) {
    const when = new Date(input.scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Pick a future date and time.',
      });
    }
    const interviewer = resolveInternalInterviewer(input.interviewTrack);
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: {
        experiences: { orderBy: { createdAt: 'desc' }, take: 1 },
        skills: { orderBy: { createdAt: 'asc' }, take: 1 },
      },
    });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    const jobRole = humanInterviewRoleFromPassport({
      careerInterests: parseJsonList(candidate.careerInterests),
      experiences: candidate.experiences,
      skills: candidate.skills,
    });
    if (!jobRole) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Complete your Career Passport first so we can use your job role.',
      });
    }
    const interviewType =
      input.interviewTrack === 'TECHNICAL' ? 'SITUATIONAL' : humanInterviewTypeFromRole(jobRole);
    const candidateName = input.candidateName.trim();
    const candidateEmail = input.candidateEmail.trim().toLowerCase();
    const created = await this.prisma.humanMockInterview.create({
      data: {
        candidateId: candidate.id,
        jobRole,
        interviewType,
        scheduledAt: when,
        joinToken: randomBytes(24).toString('hex'),
        interviewerName: interviewer.name,
        interviewerEmail: interviewer.email,
        candidateName,
        candidateEmail,
        paidAmountInr: HUMAN_INTERVIEW_PRICE_INR,
      },
    });
    const session = this.toSession(created, input.interviewTrack);
    const whenLabel = when.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    let emailSent = false;
    emailSent = await this.email.sendHumanMockInvite({
      to: candidateEmail,
      name: candidateName.split(' ')[0] || 'there',
      jobRole: created.jobRole,
      whenLabel,
      joinUrl: session.joinUrl,
      interviewerJoinUrl: session.interviewerJoinUrl,
    });
    if (emailSent) {
      await this.prisma.humanMockInterview.update({
        where: { id: created.id },
        data: { emailSentAt: new Date() },
      });
    }
    await this.email.sendHumanInterviewInterviewerInvite({
      to: interviewer.email,
      interviewerName: interviewer.name,
      candidateName,
      jobRole: created.jobRole,
      whenLabel,
      joinUrl: session.interviewerJoinUrl,
    });
    return {
      ...this.toSession({ ...created, emailSentAt: emailSent ? new Date() : null }, input.interviewTrack),
      emailSent,
    };
  }

  async getForCandidate(userId: string, id: string) {
    return this.toSession(await this.requireOwned(userId, id));
  }

  async getByToken(id: string, token: string) {
    const row = await this.prisma.humanMockInterview.findFirst({ where: { id, joinToken: token } });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'This interview was not found.' });
    }
    return this.toSession(row);
  }

  async join(id: string, input: { token?: string; userId?: string; role: 'candidate' | 'interviewer' }) {
    const row = await this.requireJoin(id, input);
    if (row.status === 'COMPLETED' || row.status === 'CANCELLED') {
      throw new BadRequestException({
        code: ErrorCode.BUSINESS_RULE_VIOLATION,
        message: 'This interview has already ended.',
      });
    }
    this.assertJoinWindow(row.scheduledAt, row.status);
    const data: { status: string; startedAt?: Date; interviewerJoined?: boolean } = { status: 'LIVE' };
    if (!row.startedAt) data.startedAt = new Date();
    if (input.role === 'interviewer') data.interviewerJoined = true;
    const updated = await this.prisma.humanMockInterview.update({ where: { id: row.id }, data });
    return this.toSession(updated);
  }

  signal(
    id: string,
    input: { token?: string; userId?: string; role: 'candidate' | 'interviewer'; kind: 'offer' | 'answer' | 'ice'; payload: unknown },
  ) {
    return this.requireJoin(id, input).then((row) => {
      this.assertJoinWindow(row.scheduledAt, row.status);
      putSignal(id, input.role, input.kind, input.payload);
      return { ok: true };
    });
  }

  peek(id: string, input: { token?: string; userId?: string; role: 'candidate' | 'interviewer' }) {
    return this.requireJoin(id, input).then((row) => {
      this.assertJoinWindow(row.scheduledAt, row.status);
      return takeSignal(id, input.role);
    });
  }

  private assertJoinWindow(scheduledAt: Date, status: string) {
    if (status === 'LIVE') return;
    const state = humanInterviewJoinState(scheduledAt);
    if (state.canJoin) return;
    const when = new Date(state.opensAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    throw new BadRequestException({
      code: ErrorCode.BUSINESS_RULE_VIOLATION,
      message: `This room opens only 5 minutes before the meeting. Please join at ${when}.`,
    });
  }

  async complete(
    userId: string,
    id: string,
    input: { durationMs: number; hadVideo: boolean; hadVoice: boolean; interviewerJoined: boolean; transcript?: string },
  ) {
    const row = await this.requireOwned(userId, id);
    if (row.status === 'COMPLETED') return this.toSession(row);
    const transcript = (input.transcript || '').trim().slice(0, 20_000);
    const feedback = this.intelligence.scoreHumanMock({
      durationMs: input.durationMs,
      hadVideo: input.hadVideo,
      hadVoice: input.hadVoice,
      interviewerJoined: input.interviewerJoined || row.interviewerJoined,
      transcript,
      jobRole: row.jobRole,
    });
    const updated = await this.prisma.humanMockInterview.update({
      where: { id: row.id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        durationMs: input.durationMs,
        hadVideo: input.hadVideo,
        hadVoice: input.hadVoice,
        interviewerJoined: input.interviewerJoined || row.interviewerJoined,
        transcriptText: transcript || null,
        score: feedback.score,
        feedbackJson: JSON.stringify(feedback),
      },
    });
    clearRoom(id);
    return this.toSession(updated);
  }

  private origin() {
    return this.config.get('WEB_ORIGIN') || 'http://localhost:3000';
  }

  private toSession(
    row: {
      id: string;
      jobRole: string;
      interviewType: string;
      scheduledAt: Date;
      status: string;
      joinToken: string;
      interviewerName: string | null;
      interviewerEmail: string | null;
      candidateName: string | null;
      candidateEmail: string | null;
      transcriptText: string | null;
      emailSentAt: Date | null;
      startedAt: Date | null;
      endedAt: Date | null;
      durationMs: number | null;
      interviewerJoined: boolean;
      score: number | null;
      feedbackJson: string | null;
    },
    interviewTrack?: HumanInterviewTrack | null,
  ): HumanMockSession {
    const origin = this.origin();
    const track =
      interviewTrack ||
      (row.interviewerEmail?.toLowerCase() === INTERNAL_INTERVIEWERS.TECHNICAL.email
        ? 'TECHNICAL'
        : row.interviewerEmail
          ? 'NON_TECHNICAL'
          : null);
    return {
      id: row.id,
      jobRole: row.jobRole,
      interviewType: row.interviewType,
      interviewTrack: track,
      scheduledAt: row.scheduledAt.toISOString(),
      status: row.status as HumanMockStatus,
      candidateName: row.candidateName,
      candidateEmail: row.candidateEmail,
      interviewerName: humanInterviewerPublicLabel(track),
      interviewerEmail: null,
      emailSent: Boolean(row.emailSentAt),
      joinUrl: `${origin}/interviews/human/${row.id}/room`,
      interviewerJoinUrl: `${origin}/interviews/human/${row.id}/room?role=interviewer&token=${row.joinToken}`,
      startedAt: row.startedAt?.toISOString() || null,
      endedAt: row.endedAt?.toISOString() || null,
      durationMs: row.durationMs,
      interviewerJoined: row.interviewerJoined,
      transcript: row.transcriptText,
      score: row.score,
      feedback: row.feedbackJson ? (JSON.parse(row.feedbackJson) as HumanMockSession['feedback']) : null,
    };
  }

  private async requireCandidate(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Candidate profile was not found' });
    }
    return candidate;
  }

  private async requireOwned(userId: string, id: string) {
    const candidate = await this.requireCandidate(userId);
    const row = await this.prisma.humanMockInterview.findFirst({ where: { id, candidateId: candidate.id } });
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'This interview was not found.' });
    }
    return row;
  }

  private async requireJoin(id: string, input: { token?: string; userId?: string; role: 'candidate' | 'interviewer' }) {
    if (input.role === 'interviewer' && input.token) {
      const row = await this.prisma.humanMockInterview.findFirst({ where: { id, joinToken: input.token } });
      if (!row) {
        throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'This interview was not found.' });
      }
      return row;
    }
    if (input.userId) return this.requireOwned(input.userId, id);
    throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'This interview was not found.' });
  }
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
