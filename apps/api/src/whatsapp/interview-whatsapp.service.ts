import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudTasksService } from '../common/tasks/cloud-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookService } from './whatsapp.webhook.service';
import type { ReminderKind } from './whatsapp.types';

/**
 * Bridge: Interview (PostgreSQL system of record) → WhatsApp communication channel.
 * Never calls Meta directly from EmployersService.
 */
@Injectable()
export class InterviewWhatsAppService {
  private readonly logger = new Logger(InterviewWhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly webhook: WhatsAppWebhookService,
    private readonly cloudTasks: CloudTasksService,
    private readonly config: ConfigService,
  ) {}

  async enqueueInvitation(interviewId: string) {
    return this.cloudTasks.enqueueWhatsAppJob(
      { type: 'interview_invitation', interviewId },
      () => this.sendInvitationNow(interviewId),
    );
  }

  async sendInvitationNow(interviewId: string) {
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
      include: {
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    if (!interview) {
      this.logger.warn(`Invitation skipped — interview ${interviewId} missing`);
      return { ok: false, reason: 'not_found' };
    }

    const phone = this.webhook.resolveNotifyPhone(interview.application.candidate);
    if (!phone) {
      await this.prisma.employerInterview.update({
        where: { id: interviewId },
        data: { whatsappStatus: 'SKIPPED_NO_PHONE_OR_OPT_IN' },
      });
      this.whatsapp.events.push({
        kind: 'INFO',
        summary: `Skipped WhatsApp invite for ${interviewId} (no phone / opt-in)`,
      });
      return { ok: false, reason: 'no_phone' };
    }

    const sent = await this.whatsapp.sendInterviewInvitation({
      to: phone,
      candidateName: interview.application.candidate.firstName || 'there',
      jobTitle: interview.application.job.title,
      scheduledAt: interview.scheduledAt,
      durationMin: interview.durationMin,
      interviewId: interview.id,
      candidateId: interview.candidateId,
      timeZone: interview.timezone,
    });

    await this.prisma.employerInterview.update({
      where: { id: interviewId },
      data: { whatsappStatus: sent.ok ? 'INVITE_SENT' : 'INVITE_FAILED' },
    });

    if (sent.ok) {
      await this.scheduleReminders(interview.id, interview.scheduledAt);
    }
    return sent;
  }

  async scheduleReminders(interviewId: string, scheduledAt: Date) {
    const kinds: Array<{ kind: ReminderKind; msBefore: number }> = [
      { kind: '24h', msBefore: 24 * 60 * 60 * 1000 },
      { kind: '2h', msBefore: 2 * 60 * 60 * 1000 },
      { kind: '15m', msBefore: 15 * 60 * 1000 },
    ];
    for (const item of kinds) {
      const runAt = new Date(scheduledAt.getTime() - item.msBefore);
      if (runAt.getTime() <= Date.now()) continue;
      await this.cloudTasks.enqueueWhatsAppJob(
        { type: 'interview_reminder', interviewId, kind: item.kind },
        () => this.webhook.sendReminderNow(interviewId, item.kind),
        runAt,
      );
    }
  }
}
