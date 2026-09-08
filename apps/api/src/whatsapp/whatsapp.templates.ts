import type { ReminderKind, WhatsAppTemplateName } from './whatsapp.types';

/** Meta template name mapping — override via env WHATSAPP_TEMPLATE_* */
export const DEFAULT_TEMPLATE_NAMES: Record<WhatsAppTemplateName, string> = {
  INTERVIEW_INVITATION: 'interview_invitation',
  INTERVIEW_CONFIRMATION: 'interview_confirmation',
  INTERVIEW_RESCHEDULE: 'interview_reschedule',
  INTERVIEW_REMINDER_24H: 'interview_reminder_24h',
  INTERVIEW_REMINDER_2H: 'interview_reminder_2h',
  INTERVIEW_REMINDER_15M: 'interview_reminder_15m',
  INTERVIEW_CANCELLED: 'interview_cancelled',
  INTERVIEW_COMPLETED: 'interview_completed',
  INTERVIEW_FEEDBACK_AVAILABLE: 'interview_feedback_available',
  TEST_MESSAGE: 'hello_world',
};

export function resolveTemplateName(
  logical: WhatsAppTemplateName,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = `WHATSAPP_TEMPLATE_${logical}`;
  return env[key]?.trim() || DEFAULT_TEMPLATE_NAMES[logical];
}

export function formatInterviewWhen(date: Date, timeZone = 'Asia/Kolkata') {
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(date);
  return { dateLabel, timeLabel };
}

export function buildInvitationText(input: {
  candidateName: string;
  jobTitle: string;
  scheduledAt: Date;
  durationMin: number;
  timeZone?: string;
}) {
  const { dateLabel, timeLabel } = formatInterviewWhen(input.scheduledAt, input.timeZone);
  return [
    `Hi ${input.candidateName}`,
    '',
    `You have been invited for an interview for ${input.jobTitle}.`,
    '',
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    `Duration: ${input.durationMin} minutes`,
    '',
    'Please confirm your availability.',
  ].join('\n');
}

export function buildConfirmationText(input: {
  candidateName: string;
  scheduledAt: Date;
  timeZone?: string;
}) {
  const { dateLabel, timeLabel } = formatInterviewWhen(input.scheduledAt, input.timeZone);
  return [
    `Great, ${input.candidateName}!`,
    '',
    `Your interview is confirmed for ${dateLabel} at ${timeLabel}.`,
    '',
    "We'll remind you before the interview.",
    '',
    'Good luck!',
  ].join('\n');
}

export function buildReminderText(
  kind: ReminderKind,
  input: {
    candidateName: string;
    jobTitle: string;
    scheduledAt: Date;
    meetingUrl?: string | null;
    timeZone?: string;
  },
) {
  const { dateLabel, timeLabel } = formatInterviewWhen(input.scheduledAt, input.timeZone);
  if (kind === '24h') {
    return [
      `Hi ${input.candidateName}`,
      '',
      `Reminder: your interview for ${input.jobTitle} is tomorrow at ${timeLabel}.`,
      `Date: ${dateLabel}`,
    ].join('\n');
  }
  if (kind === '2h') {
    return [
      `Hi ${input.candidateName}`,
      '',
      'Your interview starts in 2 hours. Please make sure you have a quiet place and a stable internet connection.',
      `Role: ${input.jobTitle}`,
      `Time: ${timeLabel}`,
    ].join('\n');
  }
  return [
    `Hi ${input.candidateName}`,
    '',
    'Your interview starts in 15 minutes.',
    input.meetingUrl ? `Start here: ${input.meetingUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function confirmPayload(interviewId: string) {
  return `CONFIRM:${interviewId}`;
}

export function reschedulePayload(interviewId: string) {
  return `RESCHEDULE:${interviewId}`;
}

export function slotPayload(interviewId: string, iso: string) {
  return `SLOT:${interviewId}:${iso}`;
}

export function startPayload(interviewId: string) {
  return `START:${interviewId}`;
}
