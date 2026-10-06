/**
 * Built-in in-app notification templates. Admins can override title/body per key
 * (Admin → Settings → Notification Templates); placeholders use {{name}} syntax.
 */
export type NotificationTemplateDefinition = {
  key: string;
  label: string;
  audience: 'CANDIDATE' | 'EMPLOYER';
  variables: string[];
  title: string;
  body: string;
};

export const NOTIFICATION_TEMPLATES = {
  APPLICATION_SUBMITTED: {
    label: 'Application submitted (to candidate)',
    audience: 'CANDIDATE',
    variables: ['jobTitle', 'company'],
    title: 'Application submitted',
    body: 'Your application for {{jobTitle}} at {{company}} was sent.',
  },
  APPLICATION_RECEIVED: {
    label: 'New application (to employer)',
    audience: 'EMPLOYER',
    variables: ['candidateName', 'jobTitle'],
    title: 'New application',
    body: '{{candidateName}} applied for {{jobTitle}}.',
  },
  APPLICATION_SHORTLISTED: {
    label: 'Candidate shortlisted',
    audience: 'CANDIDATE',
    variables: ['jobTitle', 'company'],
    title: 'You have been shortlisted',
    body: '{{company}} shortlisted you for {{jobTitle}}. They may contact you to schedule an interview.',
  },
  APPLICATION_ON_HOLD: {
    label: 'Application on hold',
    audience: 'CANDIDATE',
    variables: ['jobTitle', 'company'],
    title: 'Application on hold',
    body: '{{company}} has put your application for {{jobTitle}} on hold for now.',
  },
  APPLICATION_SELECTED: {
    label: 'Candidate selected / hired',
    audience: 'CANDIDATE',
    variables: ['jobTitle', 'company'],
    title: 'You have been selected',
    body: 'Congratulations! {{company}} selected you for {{jobTitle}}.',
  },
  APPLICATION_REJECTED: {
    label: 'Application rejected',
    audience: 'CANDIDATE',
    variables: ['jobTitle', 'company', 'feedback'],
    title: 'Application update',
    body: '{{company}} will not be moving forward with your application for {{jobTitle}}.{{feedback}}',
  },
  INTERVIEW_SCHEDULED: {
    label: 'Interview scheduled',
    audience: 'CANDIDATE',
    variables: ['company', 'jobTitle', 'when'],
    title: 'Interview scheduled',
    body: '{{company}} scheduled an interview for {{jobTitle}} on {{when}}.',
  },
  INTERVIEW_CANCELLED: {
    label: 'Interview cancelled',
    audience: 'CANDIDATE',
    variables: ['company', 'jobTitle', 'when', 'reason'],
    title: 'Interview cancelled',
    body: '{{company}} cancelled your interview for {{jobTitle}} on {{when}}.{{reason}}',
  },
  INTERVIEW_RESCHEDULED: {
    label: 'Interview rescheduled by employer',
    audience: 'CANDIDATE',
    variables: ['company', 'jobTitle'],
    title: 'Interview rescheduled',
    body: '{{company}} proposed a new time for {{jobTitle}}. Please confirm.',
  },
  INTERVIEW_RESCHEDULE_APPROVED: {
    label: 'Reschedule request approved',
    audience: 'CANDIDATE',
    variables: ['company', 'jobTitle'],
    title: 'Reschedule approved',
    body: '{{company}} approved your preferred time for {{jobTitle}}.',
  },
  JOB_APPROVED: {
    label: 'Job approved (to employer)',
    audience: 'EMPLOYER',
    variables: ['jobTitle'],
    title: 'Job approved',
    body: 'Your job "{{jobTitle}}" was approved and is now visible to candidates.',
  },
  JOB_REJECTED: {
    label: 'Job not approved (to employer)',
    audience: 'EMPLOYER',
    variables: ['jobTitle'],
    title: 'Job not approved',
    body: 'Your job "{{jobTitle}}" was not approved by the CareerBridge team. Edit the job and publish it again, or contact support.',
  },
  JOB_INVITE: {
    label: 'Invited to apply',
    audience: 'CANDIDATE',
    variables: ['company', 'jobTitle'],
    title: 'Invited to apply',
    body: 'You were invited by {{company}} for {{jobTitle}}.',
  },
} as const satisfies Record<string, Omit<NotificationTemplateDefinition, 'key'>>;

export type NotificationTemplateKey = keyof typeof NOTIFICATION_TEMPLATES;

export const NOTIFICATION_TEMPLATE_KEYS = Object.keys(NOTIFICATION_TEMPLATES) as NotificationTemplateKey[];

export function isNotificationTemplateKey(key: string): key is NotificationTemplateKey {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_TEMPLATES, key);
}

export function renderTemplateText(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const value = vars[name];
    return value == null ? '' : String(value);
  });
}

/** Renders the built-in default for a key (what callers show when no admin override exists). */
export function renderDefaultNotification(
  key: NotificationTemplateKey,
  vars: Record<string, string | null | undefined>,
): { title: string; body: string } {
  const template = NOTIFICATION_TEMPLATES[key];
  return { title: renderTemplateText(template.title, vars), body: renderTemplateText(template.body, vars) };
}

/** Placeholders in text that are not variables of the template. */
export function unknownTemplateVariables(key: NotificationTemplateKey, text: string): string[] {
  const allowed = new Set<string>(NOTIFICATION_TEMPLATES[key].variables);
  const used = [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(used.filter((name) => !allowed.has(name)))];
}
