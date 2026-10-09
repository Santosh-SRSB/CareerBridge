'use client';

import type { FormEvent, ReactNode } from 'react';
import type { SuperAdminNavId } from '@/lib/admin-portal';
import {
  adminInterviewFlowSteps,
  adminInterviewStatusLabel,
  adminWhatsAppStatusLabel,
} from '@/lib/admin-interview-status';

/** Every module shares the portal palette; values resolve against the tokens on `.role-shell`. */
const SA_TONE = {
  accent: 'var(--sa-brand)',
  soft: 'var(--sa-tint)',
  ink: 'var(--sa-muted)',
  panel: 'var(--sa-surface-alt)',
  pattern: 'none',
};

export const TAB_THEME: Record<
  SuperAdminNavId,
  {
    accent: string;
    soft: string;
    ink: string;
    title: string;
    blurb: string;
    panel: string;
    pattern: string;
  }
> = {
  dashboard: { ...SA_TONE, title: 'Dashboard', blurb: 'Platform snapshot and quick jumps' },
  candidates: { ...SA_TONE, title: 'Candidates', blurb: 'People directory · profile cards' },
  employers: { ...SA_TONE, title: 'Employers', blurb: 'Company verification board' },
  jobs: { ...SA_TONE, title: 'Jobs', blurb: 'Moderation strip by status color' },
  applications: { ...SA_TONE, title: 'Applications', blurb: 'Pipeline tickets across employers' },
  interviews: { ...SA_TONE, title: 'Interviews', blurb: 'Schedule timeline cards' },
  skills: { ...SA_TONE, title: 'Skills', blurb: 'Taxonomy chips and master data' },
  'ai-usage': { ...SA_TONE, title: 'AI Usage', blurb: 'Cost and feature consumption' },
  notifications: { ...SA_TONE, title: 'Notifications', blurb: 'Inbox + WhatsApp delivery board' },
  testimonials: { ...SA_TONE, title: 'Testimonials', blurb: 'Approve or reject public feedback quotes' },
  reports: { ...SA_TONE, title: 'Reports', blurb: 'Operational metric packs' },
  admins: { ...SA_TONE, title: 'Administration', blurb: 'Staff access control' },
  settings: { ...SA_TONE, title: 'Settings', blurb: 'Controlled platform configuration' },
  audit: { ...SA_TONE, title: 'Audit', blurb: 'Chronological action trail' },
  account: { ...SA_TONE, title: 'My Account', blurb: 'Your portal sign-in and password' },
};

const OK_STATUSES = ['ACTIVE', 'PUBLISHED', 'CONFIRMED', 'HIRED', 'DELIVERED', 'SELECTED', 'COMPLETED', 'SUCCESS', 'VERIFIED', 'APPROVED'];
const BAD_STATUSES = ['SUSPENDED', 'CLOSED', 'FAILED', 'REJECTED', 'CANCELLED', 'INACTIVE'];
const WARN_STATUSES = ['PAUSED', 'PENDING', 'PENDING_REVIEW', 'QUEUED', 'DRAFT', 'SHORTLISTED', 'SCHEDULED', 'PROPOSED', 'RESCHEDULE_NEEDED', 'RESCHEDULE_REQUESTED', 'UNDER_REVIEW', 'ON_HOLD', 'PROFILE_SHORTLISTED', 'INTERVIEW_RESCHEDULED', 'FEEDBACK_PENDING'];

/** `status` picks the tone; `label` (e.g. an admin display label) replaces the text when given. */
export function StatusPill({ status, label }: { status: string; label?: string | null }) {
  const s = status.toUpperCase();
  const tone = OK_STATUSES.includes(s)
    ? 'sa-pill--ok'
    : BAD_STATUSES.includes(s)
      ? 'sa-pill--bad'
      : WARN_STATUSES.includes(s)
        ? 'sa-pill--warn'
        : '';
  return <span className={`sa-pill ${tone}`}>{label || status || '—'}</span>;
}

export function ModuleBanner({ tab }: { tab: SuperAdminNavId }) {
  const t = TAB_THEME[tab];
  return (
    <div className="sa-hero mb-4 flex flex-wrap items-end justify-between gap-3 px-4 py-3 sm:px-5">
      <div>
        <p className="sa-eyebrow">Module</p>
        <h1 className="sa-h1">{t.title}</h1>
        <p className="sa-muted text-xs">{t.blurb}</p>
      </div>
      <p className="sa-crumb">
        Home <span className="mx-1">›</span> {t.title}
      </p>
    </div>
  );
}

export function ModuleCanvas({ children }: { tab: SuperAdminNavId; children: ReactNode }) {
  return <div className="sa-canvas p-3 sm:p-4">{children}</div>;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  filter,
}: {
  accent?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  placeholder: string;
  filter?: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="sa-card mb-4 flex flex-wrap items-center gap-2 p-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="sa-input min-w-[200px] flex-1 px-3 py-2 text-sm"
      />
      {filter}
      <button type="submit" className="sa-btn">
        Search
      </button>
    </form>
  );
}

export type ActionTone = 'primary' | 'secondary' | 'strong' | 'danger';

const ACTION_TONE_CLASS: Record<ActionTone, string> = {
  primary: '',
  secondary: 'sa-act--line',
  strong: 'sa-act--strong',
  danger: 'sa-act--danger',
};

/** `danger` and `accent` remain for older callers; the tone comes from `tone` (or `danger` → strong). */
export function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
  tone,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  accent?: string;
  tone?: ActionTone;
}) {
  const resolved: ActionTone = tone ?? (danger ? 'strong' : 'primary');
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`sa-act ${ACTION_TONE_CLASS[resolved]}`}>
      {children}
    </button>
  );
}

function txt(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    // ISO timestamps → readable local datetime
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }
    // Gemini / API error JSON → short message
    if (value.trim().startsWith('{') && value.includes('"message"')) {
      try {
        const parsed = JSON.parse(value) as { error?: { message?: string }; message?: string };
        return parsed.error?.message || parsed.message || value;
      } catch {
        return value;
      }
    }
    return value;
  }
  return '—';
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="sa-label">{label}</p>
      <p className="sa-ink mt-0.5 text-sm font-medium [overflow-wrap:anywhere]">{txt(value)}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="sa-inset min-w-0 p-3">
      <p className="sa-label mb-2">{title}</p>
      {children}
    </div>
  );
}

function asList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object');
}

function personName(data: Record<string, unknown>) {
  if (data.name) return txt(data.name);
  const profile = (data.profile && typeof data.profile === 'object' ? data.profile : {}) as Record<string, unknown>;
  const joined = [profile.firstName ?? data.firstName, profile.lastName ?? data.lastName].filter(Boolean).join(' ');
  if (joined) return joined;
  const candidate = data.candidate as Record<string, unknown> | undefined;
  if (candidate) {
    const n = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ');
    if (n) return n;
  }
  return '—';
}

function InterviewStatusFlow({
  status,
  events,
}: {
  status: string;
  events: Array<Record<string, unknown>>;
}) {
  const { steps, cancelled } = adminInterviewFlowSteps(status);
  return (
    <Section title="Interview status flow">
      {cancelled ? (
        <p className="sa-notice sa-notice--error mb-2 px-2 py-1 text-xs font-semibold">
          Cancelled — this interview is outside the normal flow.
        </p>
      ) : null}
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Interview status flow">
        {steps.map((step, i) => (
          <li key={step.key} className="flex items-center gap-1.5">
            <span aria-current={step.current ? 'step' : undefined} className="sa-step px-2.5 py-1 text-[11px]">
              {step.label}
            </span>
            {i < steps.length - 1 ? (
              <span className="sa-muted" aria-hidden="true">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="sa-muted mt-2 text-[11px]">
        Highlighted stage is the current status. Not every candidate passes through every stage.
      </p>
      {events.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {events.map((event, i) => (
            <li key={`${txt(event.at)}-${i}`} className="sa-muted text-xs">
              <span className="sa-ink font-semibold">{txt(event.label)}</span> · {txt(event.at)}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

/** Human-readable record viewer — never dumps raw JSON. */
export function DetailPanel({
  title,
  data,
  onClose,
}: {
  title: string;
  data: Record<string, unknown>;
  accent?: string;
  onClose: () => void;
}) {
  const kind = String(data.kind || '');
  const adminStatus = typeof data.adminStatus === 'string' ? data.adminStatus : '';
  const adminStatusLabel = adminInterviewStatusLabel(adminStatus);
  const status = adminStatus || String(data.accountStatus ?? data.status ?? '');
  const statusEvents = asList(data.statusEvents);
  const email =
    data.email ??
    (data.user && typeof data.user === 'object' ? (data.user as Record<string, unknown>).email : null);
  const phone =
    data.phone ??
    (data.user && typeof data.user === 'object' ? (data.user as Record<string, unknown>).phone : null);
  const profile =
    data.profile && typeof data.profile === 'object' ? (data.profile as Record<string, unknown>) : null;
  const skills: Array<Record<string, unknown>> = asList(data.skills).length
    ? asList(data.skills)
    : Array.isArray(data.primarySkills)
      ? (data.primarySkills as unknown[]).map((name) => ({ name }))
      : [];
  const education = asList(data.education);
  const experience = asList(data.experience).length ? asList(data.experience) : asList(data.experiences);
  const resumes = asList(data.resumes);
  const applications = asList(data.applications).length
    ? asList(data.applications)
    : asList(data.applicationList);
  const interviews = asList(data.interviews);
  const jobs = asList(data.jobs);
  const activity = asList(data.activity);
  const notifications = asList(data.notifications);
  const resume =
    data.resume && typeof data.resume === 'object' ? (data.resume as Record<string, unknown>) : null;
  const counts =
    data.counts && typeof data.counts === 'object' ? (data.counts as Record<string, unknown>) : null;
  const employer =
    data.employer && typeof data.employer === 'object' ? (data.employer as Record<string, unknown>) : null;
  const job = data.job && typeof data.job === 'object' ? (data.job as Record<string, unknown>) : null;
  const plan = data.plan && typeof data.plan === 'object' ? (data.plan as Record<string, unknown>) : null;
  const credits =
    data.credits && typeof data.credits === 'object' ? (data.credits as Record<string, unknown>) : null;
  const candidate =
    data.candidate && typeof data.candidate === 'object' ? (data.candidate as Record<string, unknown>) : null;
  const location =
    (typeof data.location === 'string' && data.location) ||
    [data.city, data.state].filter(Boolean).join(', ') ||
    (candidate ? txt(candidate.city) : '') ||
    null;

  const heading =
    kind === 'employers'
      ? txt(data.companyName)
      : kind === 'jobs'
        ? txt(data.title)
        : kind === 'applications'
          ? `${personName(data)} → ${txt(job?.title ?? data.jobTitle)}`
          : kind === 'interviews'
            ? `${personName(data)} · ${txt(job?.title ?? data.jobTitle)}`
            : personName(data);

  return (
    <section className="sa-card overflow-hidden">
      <div className="sa-ccard-h flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="sa-on-dark-muted text-[10px] font-bold uppercase tracking-[0.1em]">{title}</p>
          <h2 className="text-lg font-extrabold [overflow-wrap:anywhere]">{heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          {status ? <StatusPill status={status} label={adminStatusLabel} /> : null}
          <button type="button" className="sa-btn sa-btn--line sa-btn--on-dark min-h-9 px-4 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="grid max-h-[32rem] gap-3 overflow-y-auto p-4 md:grid-cols-2">
        <Section title="Overview">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name / title" value={heading} />
            <Field label="Status" value={adminStatusLabel || status || '—'} />
            {adminStatus && data.applicationStatus ? (
              <Field label="Application status" value={data.applicationStatus} />
            ) : null}
            <Field label="Email" value={email} />
            <Field label="Phone" value={phone} />
            <Field label="Location" value={location} />
            <Field
              label="Profile completion"
              value={data.profileCompletion != null ? `${data.profileCompletion}%` : null}
            />
            <Field label="Created" value={data.createdAt} />
            {data.verified != null ? <Field label="Verified" value={data.verified} /> : null}
            {data.matchScore != null || data.match ? (
              <Field
                label="Match score"
                value={
                  data.matchScore ??
                  (data.match && typeof data.match === 'object'
                    ? (data.match as Record<string, unknown>).totalScore
                    : null)
                }
              />
            ) : null}
            {data.scheduledAt ? <Field label="Scheduled" value={data.scheduledAt} /> : null}
            {data.mode ? <Field label="Mode" value={data.mode} /> : null}
            {data.whatsappStatus ? (
              <Field
                label="WhatsApp"
                value={adminStatus ? adminWhatsAppStatusLabel(data.whatsappStatus) : data.whatsappStatus}
              />
            ) : null}
          </div>
        </Section>

        {adminStatusLabel && <InterviewStatusFlow status={adminStatus} events={statusEvents} />}

        {(kind === 'candidates' || profile) && (
          <Section title="Profile">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Experience level" value={profile?.experienceLevel ?? data.experienceLevel} />
              <Field label="Highest education" value={data.highestEducation ?? profile?.highestEducation} />
              <Field label="Onboarded" value={profile?.onboardingCompleted ?? data.onboardingCompleted} />
            </div>
            {Boolean(profile?.about || data.about) && (
              <p className="sa-muted mt-3 text-sm leading-relaxed">{txt(profile?.about ?? data.about)}</p>
            )}
          </Section>
        )}

        {(kind === 'employers' || counts) && (
          <Section title="Company activity">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jobs" value={counts?.jobs ?? data.jobs} />
              <Field label="Applications" value={counts?.applications ?? data.applications} />
              <Field label="Interviews" value={counts?.interviews ?? data.interviews} />
              <Field label="Hires" value={counts?.hires} />
              <Field label="Verification" value={data.verificationStatus} />
              <Field label="City" value={data.city} />
            </div>
          </Section>
        )}

        {(plan || credits) && (
          <Section title="Plan & credits">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plan" value={plan?.name} />
              <Field label="Billing period" value={plan?.period} />
              <Field
                label="Active jobs"
                value={
                  plan
                    ? `${txt(plan.activeJobs)} / ${plan.activeJobLimit == null ? 'Unlimited' : txt(plan.activeJobLimit)}`
                    : null
                }
              />
              <Field label="Candidate views used" value={credits?.candidateViewsUsed} />
              <Field
                label="Candidate view credits"
                value={credits ? (credits.candidateViewCredits == null ? 'Unlimited' : credits.candidateViewCredits) : null}
              />
              <Field
                label="Credits remaining"
                value={credits ? (credits.remaining == null ? 'Unlimited' : credits.remaining) : null}
              />
            </div>
          </Section>
        )}

        {Boolean(kind === 'jobs' || employer || data.description) && (
          <Section title="Job info">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company" value={employer?.companyName ?? data.companyName} />
              <Field label="City" value={data.city} />
              <Field label="Applications" value={data.applications} />
              <Field label="Published" value={data.publishedAt} />
            </div>
            {data.description ? (
              <p className="sa-muted mt-3 max-h-28 overflow-auto text-xs leading-relaxed">{txt(data.description)}</p>
            ) : null}
          </Section>
        )}

        {(kind === 'applications' || candidate || job) && kind !== 'candidates' && (
          <Section title="Application parties">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Candidate"
                value={
                  candidate
                    ? [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
                    : data.candidateName
                }
              />
              <Field label="Job" value={job?.title ?? data.jobTitle} />
              <Field
                label="Company"
                value={
                  (job?.employer && typeof job.employer === 'object'
                    ? (job.employer as Record<string, unknown>).companyName
                    : null) ?? data.companyName
                }
              />
              <Field label="Job city" value={job?.city} />
            </div>
          </Section>
        )}

        {skills.length > 0 && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s, i) => (
                <span key={String(s.id ?? s.name ?? i)} className="sa-tag px-2.5 py-1 text-[11px]">
                  {txt(s.name)}
                </span>
              ))}
            </div>
          </Section>
        )}

        {education.length > 0 && (
          <Section title="Education history">
            <ul className="space-y-2">
              {education.slice(0, 8).map((row, i) => (
                <li key={String(row.id ?? i)} className="border-b border-[var(--sa-tint2)] pb-2 text-sm last:border-0">
                  <p className="sa-ink font-semibold">{txt(row.qualification)}</p>
                  <p className="sa-muted text-xs">
                    {[row.institution, row.fieldOfStudy, row.yearCompleted].filter(Boolean).map(txt).join(' · ') || '—'}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {experience.length > 0 && (
          <Section title="Work experience">
            <ul className="space-y-2">
              {experience.slice(0, 8).map((row, i) => (
                <li key={String(row.id ?? i)} className="border-b border-[var(--sa-tint2)] pb-2 text-sm last:border-0">
                  <p className="sa-ink font-semibold">{txt(row.jobTitle)}</p>
                  <p className="sa-muted text-xs font-medium">{txt(row.company)}</p>
                  {row.description ? <p className="mt-1 sa-muted text-xs">{txt(row.description)}</p> : null}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {resumes.length > 0 && (
          <Section title="Resumes">
            <ul className="space-y-2">
              {resumes.slice(0, 6).map((row, i) => (
                <li
                  key={String(row.id ?? i)}
                  className="flex items-center justify-between gap-2 border-b border-[var(--sa-tint2)] pb-2 text-xs last:border-0"
                >
                  <span className="sa-ink font-semibold">{txt(row.title)}</span>
                  <span className="sa-muted">
                    Score {txt(row.score)} · {txt(row.kind)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {applications.length > 0 && (
          <Section title="Applications">
            <ul className="space-y-2">
              {applications.slice(0, 8).map((row, i) => (
                <li key={String(row.id ?? i)} className="flex items-center justify-between gap-2 text-xs">
                  <span className="sa-ink">
                    {txt(row.jobTitle)} · {txt(row.companyName)}
                  </span>
                  <StatusPill status={String(row.status ?? '')} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {interviews.length > 0 && (
          <Section title="Interviews">
            <ul className="space-y-2">
              {interviews.slice(0, 8).map((row, i) => (
                <li key={String(row.id ?? i)} className="sa-muted text-xs">
                  <p className="sa-ink font-semibold">
                    {txt(row.jobTitle)} · {txt(row.companyName)}
                  </p>
                  <p className="mt-1 sa-muted">{txt(row.scheduledAt)}</p>
                  <div className="mt-1">
                    <StatusPill status={String(row.status ?? '')} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {jobs.length > 0 && (
          <Section title="Jobs">
            <ul className="space-y-2">
              {jobs.slice(0, 8).map((row, i) => (
                <li key={String(row.id ?? i)} className="flex items-center justify-between gap-2 text-xs">
                  <span className="sa-ink font-semibold">{txt(row.title)}</span>
                  <StatusPill status={String(row.status ?? '')} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {resume && (
          <Section title="Linked resume">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title" value={resume.title} />
              <Field label="Score" value={resume.score} />
              <Field label="Version" value={resume.version} />
              <Field label="Kind" value={resume.kind} />
            </div>
          </Section>
        )}

        {notifications.length > 0 && (
          <Section title="WhatsApp / notifications">
            <ul className="space-y-2">
              {notifications.slice(0, 8).map((row, i) => (
                <li key={String(row.id ?? i)} className="flex items-center justify-between gap-2 text-xs">
                  <span className="sa-ink">
                    {txt(row.template)} · {txt(row.to)}
                  </span>
                  <StatusPill status={String(row.status ?? '')} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {activity.length > 0 && (
          <Section title="Activity">
            <ul className="space-y-2">
              {activity.slice(0, 12).map((row, i) => (
                <li key={String(row.id ?? i)} className="border-b border-[var(--sa-tint2)] pb-2 text-xs last:border-0">
                  <p className="sa-ink font-semibold">{txt(row.action)}</p>
                  <p className="sa-muted">
                    {txt(row.time)} · {txt(row.actor)}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </section>
  );
}
