import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudTasksService } from '../common/tasks/cloud-tasks.service';
import { interviewMeetingUrl } from '../common/web/public-web-url';
import { parseNotifyPrefs } from '../employers/employer-policy';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookService } from './whatsapp.webhook.service';

export type InvitationKind = 'initial' | 'reschedule';

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

  /**
   * `initial`: first invitation, followed by the meeting link.
   * `reschedule`: employer set a new time; only the new date/time goes out. The meeting link is
   * sent again only once the candidate confirms the new time.
   */
  async enqueueInvitation(interviewId: string, kind: InvitationKind = 'initial') {
    return this.cloudTasks.enqueueWhatsAppJob(
      { type: 'interview_invitation', interviewId, kind },
      () => this.sendInvitationNow(interviewId, kind),
    );
  }

  async sendInvitationNow(interviewId: string, kind: InvitationKind = 'initial') {
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
    if (!parseNotifyPrefs(interview.notes).whatsapp) {
      await this.prisma.employerInterview.update({
        where: { id: interviewId },
        data: { whatsappStatus: 'SKIPPED_BY_EMPLOYER' },
      });
      return { ok: false, reason: 'skipped_by_employer' };
    }
    if (interview.status === 'CANCELLED' || interview.status === 'COMPLETED') {
      return { ok: false, reason: 'interview_closed' };
    }
    if (interview.status !== 'SCHEDULED' && interview.status !== 'PROPOSED') {
      return { ok: false, reason: `not_awaiting_confirmation_${interview.status}` };
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
      data: {
        whatsappStatus: sent.ok
          ? kind === 'reschedule' ? 'RESCHEDULE_INVITE_SENT' : 'INVITE_SENT'
          : kind === 'reschedule' ? 'RESCHEDULE_INVITE_FAILED' : 'INVITE_FAILED',
      },
    });

    // Reminders are scheduled only after CONFIRM (not on invitation) — see scheduleReminders.
    if (sent.ok && kind === 'initial') {
      await this.whatsapp
        .sendText({
          to: phone,
          body: `Meeting link: ${interviewMeetingUrl(this.config, interview)}`,
          candidateId: interview.candidateId,
          interviewId: interview.id,
          messageType: 'interview_meeting_link',
        })
        .catch(() => undefined);
    }
    return sent;
  }

  markRescheduleNeeded(interviewId: string, source: 'PORTAL' | 'WHATSAPP') {
    return this.webhook.markRescheduleNeeded(interviewId, source);
  }

  /** Portal confirm path — text confirmation (not interactive invite). */
  async sendConfirmationNow(interviewId: string) {
    const interview = await this.prisma.employerInterview.findUnique({
      where: { id: interviewId },
      include: {
        application: { include: { candidate: { include: { user: true } }, job: true } },
      },
    });
    if (!interview) return { ok: false as const, reason: 'not_found' };
    if (!parseNotifyPrefs(interview.notes).whatsapp) return { ok: false as const, reason: 'skipped_by_employer' };

    const phone = this.webhook.resolveNotifyPhone(interview.application.candidate);
    if (!phone) return { ok: false as const, reason: 'no_phone' };

    const sent = await this.whatsapp.sendInterviewConfirmation({
      to: phone,
      candidateName: interview.application.candidate.firstName || 'there',
      scheduledAt: interview.scheduledAt,
      interviewId: interview.id,
      candidateId: interview.candidateId,
      timeZone: interview.timezone,
      meetingUrl: interviewMeetingUrl(this.config, interview),
    });

    if (sent.ok) {
      await this.scheduleReminders(interview.id, interview.scheduledAt);
    }

    return sent;
  }

  async scheduleReminders(interviewId: string, scheduledAt: Date) {
    return this.webhook.scheduleReminders(interviewId, scheduledAt);
  }
}
