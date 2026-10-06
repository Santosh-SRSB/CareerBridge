import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../auth/email.service';
import { publicWebBase } from '../common/web/public-web-url';
import { formatAvailabilityWindow, parseCandidateAvailability } from '../employers/employer-policy';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/** Statuses from which a candidate may share availability (website form). */
export const AVAILABILITY_SUBMITTABLE_STATUSES = [
  'PROPOSED',
  'SCHEDULED',
  'CONFIRMED',
  'RESCHEDULE_NEEDED',
  'RESCHEDULE_REQUESTED',
] as const;

export type AvailabilitySource = 'PORTAL' | 'WHATSAPP_FLOW';

export type AvailabilityResult =
  | { ok: true; changed: boolean; interviewId: string; label: string }
  | { ok: false; reason: 'not_found' | 'closed' | 'not_allowed' | 'invalid'; message: string; status?: string };

const RESCHEDULE_PREF_RE = /\[\[RESCHEDULE_PREF:([^\]]+)\]\]/;
const RESCHEDULE_REASON_RE = /\[\[RESCHEDULE_REASON:([^\]]*)\]\]/;

function stripRescheduleMarkers(notes: string | null | undefined) {
  return (notes || '')
    .replace(RESCHEDULE_PREF_RE, '')
    .replace(RESCHEDULE_REASON_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The single implementation of "candidate shares the date and time range they are available"
 * (→ RESCHEDULE_REQUESTED), used by the website form and the WhatsApp Flow.
 */
@Injectable()
export class InterviewAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async submitAvailability(input: {
    interviewId: string;
    candidateId: string;
    body: { date?: string; availableFrom?: string; availableUntil?: string; timezone?: string };
    source: AvailabilitySource;
    /** Narrower set of statuses for a channel (subset of AVAILABILITY_SUBMITTABLE_STATUSES). */
    allowedStatuses?: readonly string[];
  }): Promise<AvailabilityResult> {
    const row = await this.prisma.employerInterview.findFirst({
      where: { id: input.interviewId, candidateId: input.candidateId },
      include: {
        employer: { include: { user: true } },
        application: { include: { job: true, candidate: true } },
      },
    });
    if (!row) return { ok: false, reason: 'not_found', message: 'Interview was not found' };
    if (row.status === 'CANCELLED' || row.status === 'COMPLETED') {
      return { ok: false, reason: 'closed', message: 'This interview can no longer be rescheduled.', status: row.status };
    }
    const allowed = AVAILABILITY_SUBMITTABLE_STATUSES.filter(
      (s) => !input.allowedStatuses || input.allowedStatuses.includes(s),
    );
    if (!(allowed as readonly string[]).includes(row.status)) {
      return { ok: false, reason: 'not_allowed', message: 'This interview cannot be rescheduled right now.', status: row.status };
    }

    const parsed = parseCandidateAvailability(input.body);
    if (!parsed.ok) return { ok: false, reason: 'invalid', message: parsed.message };
    const availability = parsed.value;
    const label = formatAvailabilityWindow(availability.availableFrom, availability.availableUntil, availability.timezone);

    // Atomic: concurrent or repeated submits of the same window update and notify only once.
    const claimed = await this.prisma.employerInterview.updateMany({
      where: {
        id: row.id,
        candidateId: input.candidateId,
        status: { in: allowed },
        OR: [
          { status: { not: 'RESCHEDULE_REQUESTED' } },
          { candidateAvailableFrom: null },
          { candidateAvailableUntil: null },
          { candidateAvailableFrom: { not: availability.availableFrom } },
          { candidateAvailableUntil: { not: availability.availableUntil } },
        ],
      },
      data: {
        status: 'RESCHEDULE_REQUESTED',
        confirmedAt: null,
        whatsappStatus: input.source === 'WHATSAPP_FLOW' ? 'AVAILABILITY_SUBMITTED_VIA_WA_FLOW' : 'AVAILABILITY_SUBMITTED_VIA_PORTAL',
        candidateProposedDate: availability.proposedDate,
        candidateAvailableFrom: availability.availableFrom,
        candidateAvailableUntil: availability.availableUntil,
        candidateTimezone: availability.timezone,
        candidateRescheduleRequestedAt: row.candidateRescheduleRequestedAt || new Date(),
        notes: stripRescheduleMarkers(row.notes) || null,
      },
    });
    if (claimed.count === 0) return { ok: true, changed: false, interviewId: row.id, label };

    const candidate = row.application.candidate;
    const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ').trim() || 'A candidate';
    const jobTitle = row.application.job.title;
    const employerUser = row.employer.user;

    await this.notifications
      .create({
        userId: candidate.userId,
        title: 'Availability sent',
        body: `Your new availability has been sent to the employer. Candidate proposed time: ${label}.`,
        type: 'INTERVIEW',
        link: `/interviews/scheduled/${row.id}`,
      })
      .catch(() => undefined);

    if (employerUser?.id) {
      await this.notifications
        .create({
          userId: employerUser.id,
          title: 'Candidate proposed a new time',
          body: `${candidateName} shared their availability for ${jobTitle}. Candidate proposed time: ${label}.`,
          type: 'INTERVIEW',
          link: `/employer/interviews`,
        })
        .catch(() => undefined);

      if (employerUser.email) {
        await this.email
          .sendEmployerInterviewRescheduleRequest({
            to: employerUser.email,
            employerName: row.employer.contactName || 'there',
            candidateName,
            jobTitle,
            preferredLabel: label,
            portalUrl: `${publicWebBase(this.config)}/employer/interviews`,
          })
          .catch(() => undefined);
      }
    }

    return { ok: true, changed: true, interviewId: row.id, label };
  }
}
