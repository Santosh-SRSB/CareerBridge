type ConfigLike = { get<T = string>(key: string): T | undefined };

/**
 * Base URL for links that leave the server (WhatsApp, email). WEB_ORIGIN is a CORS list whose
 * first entry is often http://localhost:3000, so prefer PUBLIC_WEB_URL, then the first public https origin.
 */
export function publicWebBase(config: ConfigLike): string {
  const explicit = (config.get<string>('PUBLIC_WEB_URL') || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const origins = (config.get<string>('WEB_ORIGIN') || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const isLocal = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  return origins.find((origin) => /^https:\/\//i.test(origin) && !isLocal(origin)) || origins[0] || 'http://localhost:3000';
}

export function candidateInterviewUrl(config: ConfigLike, interviewId: string) {
  return `${publicWebBase(config)}/interviews/scheduled/${interviewId}`;
}

/** Employer's meeting link (location URL wins, so a changed link replaces the stored one), else the portal page. */
export function interviewMeetingUrl(
  config: ConfigLike,
  interview: { id: string; location?: string | null; meetingUrl?: string | null },
) {
  const location = (interview.location || '').trim();
  if (/^https?:\/\//i.test(location)) return location;
  const stored = (interview.meetingUrl || '').trim();
  if (stored && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(stored)) return stored;
  return candidateInterviewUrl(config, interview.id);
}

/** Interview id is the last path segment so it can be a Meta template URL-button suffix ({{1}}). */
export function candidateRescheduleUrl(config: ConfigLike, interviewId: string) {
  return `${publicWebBase(config)}/interviews/reschedule/${interviewId}`;
}
