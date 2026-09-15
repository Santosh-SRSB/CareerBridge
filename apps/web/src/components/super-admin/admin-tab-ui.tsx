'use client';

import type { FormEvent, ReactNode } from 'react';
import type { SuperAdminNavId } from '@/lib/admin-portal';

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
  dashboard: {
    accent: '#27a9e3',
    soft: '#e8f6fc',
    ink: '#1a6d96',
    title: 'Dashboard',
    blurb: 'Platform snapshot and quick jumps',
    panel: '#f4fafd',
    pattern: 'radial-gradient(circle at 0% 0%, rgba(39,169,227,0.12), transparent 45%)',
  },
  candidates: {
    accent: '#27a9e3',
    soft: '#e3f4fb',
    ink: '#1a6d96',
    title: 'Candidates',
    blurb: 'People directory · profile cards',
    panel: '#f3faff',
    pattern: 'linear-gradient(135deg, rgba(39,169,227,0.08), transparent 50%)',
  },
  employers: {
    accent: '#28b779',
    soft: '#e7f8f1',
    ink: '#1a7a52',
    title: 'Employers',
    blurb: 'Company verification board',
    panel: '#f3fbf7',
    pattern: 'linear-gradient(135deg, rgba(40,183,121,0.1), transparent 55%)',
  },
  jobs: {
    accent: '#ffb848',
    soft: '#fff6e8',
    ink: '#9a6a12',
    title: 'Jobs',
    blurb: 'Moderation strip by status color',
    panel: '#fffaf2',
    pattern: 'repeating-linear-gradient(-45deg, rgba(255,184,72,0.08) 0 8px, transparent 8px 16px)',
  },
  applications: {
    accent: '#da542e',
    soft: '#fdece7',
    ink: '#8f3218',
    title: 'Applications',
    blurb: 'Pipeline tickets across employers',
    panel: '#fff8f5',
    pattern: 'radial-gradient(circle at 100% 0%, rgba(218,84,46,0.12), transparent 40%)',
  },
  interviews: {
    accent: '#2255a4',
    soft: '#e8eef8',
    ink: '#163a72',
    title: 'Interviews',
    blurb: 'Schedule timeline cards',
    panel: '#f4f7fc',
    pattern: 'linear-gradient(180deg, rgba(34,85,164,0.08), transparent 40%)',
  },
  skills: {
    accent: '#852b99',
    soft: '#f5eaf8',
    ink: '#5c1d6a',
    title: 'Skills',
    blurb: 'Taxonomy chips and master data',
    panel: '#fbf6fd',
    pattern: 'radial-gradient(circle at 20% 20%, rgba(133,43,153,0.12), transparent 45%)',
  },
  'ai-usage': {
    accent: '#f74d4d',
    soft: '#fdeceb',
    ink: '#a12828',
    title: 'AI Usage',
    blurb: 'Cost and feature consumption',
    panel: '#fff6f6',
    pattern: 'linear-gradient(120deg, rgba(247,77,77,0.1), transparent 50%)',
  },
  notifications: {
    accent: '#0aa3c2',
    soft: '#e6f7fb',
    ink: '#0a6f84',
    title: 'Notifications',
    blurb: 'Inbox + WhatsApp delivery board',
    panel: '#f2fbfd',
    pattern: 'repeating-linear-gradient(90deg, rgba(10,163,194,0.06) 0 12px, transparent 12px 24px)',
  },
  reports: {
    accent: '#1f9d68',
    soft: '#e8f8f0',
    ink: '#146b47',
    title: 'Reports',
    blurb: 'Operational metric packs',
    panel: '#f3faf6',
    pattern: 'linear-gradient(45deg, rgba(31,157,104,0.08), transparent 55%)',
  },
  admins: {
    accent: '#2b3643',
    soft: '#eceef1',
    ink: '#2b3643',
    title: 'Administration',
    blurb: 'Staff access control',
    panel: '#f5f6f8',
    pattern: 'linear-gradient(180deg, rgba(43,54,67,0.08), transparent 35%)',
  },
  settings: {
    accent: '#5c6570',
    soft: '#f0f1f2',
    ink: '#333940',
    title: 'Settings',
    blurb: 'Controlled platform configuration',
    panel: '#f7f7f8',
    pattern: 'repeating-linear-gradient(0deg, rgba(92,101,112,0.05) 0 1px, transparent 1px 12px)',
  },
  audit: {
    accent: '#d97706',
    soft: '#fff7e8',
    ink: '#92400e',
    title: 'Audit',
    blurb: 'Chronological action trail',
    panel: '#fffbf3',
    pattern: 'linear-gradient(135deg, rgba(217,119,6,0.1), transparent 50%)',
  },
};

export function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  const bg =
    ['ACTIVE', 'PUBLISHED', 'CONFIRMED', 'HIRED', 'DELIVERED', 'SELECTED', 'COMPLETED', 'SUCCESS', 'VERIFIED'].includes(s)
      ? '#28b779'
      : ['SUSPENDED', 'CLOSED', 'FAILED', 'REJECTED', 'CANCELLED', 'INACTIVE'].includes(s)
        ? '#da542e'
        : ['PAUSED', 'PENDING', 'QUEUED', 'DRAFT', 'SHORTLISTED', 'SCHEDULED', 'PROPOSED', 'RESCHEDULE_REQUESTED', 'UNDER_REVIEW'].includes(
              s,
            )
          ? '#ffb848'
          : '#27a9e3';
  return (
    <span
      className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: bg }}
    >
      {status || '—'}
    </span>
  );
}

export function ModuleBanner({ tab }: { tab: SuperAdminNavId }) {
  const t = TAB_THEME[tab];
  return (
    <div
      className="matrix-dash-hero mb-4 flex flex-wrap items-end justify-between gap-3 border-l-4 px-4 py-3"
      style={{ borderColor: t.accent }}
    >
      <div className="relative z-[1]">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: t.ink }}>
          Module
        </p>
        <h1 className="text-2xl font-semibold text-[#444]">{t.title}</h1>
        <p className="text-xs" style={{ color: t.ink }}>
          {t.blurb}
        </p>
      </div>
      <p className="relative z-[1] text-xs text-[#999]">
        Home <span className="mx-1">›</span> {t.title}
      </p>
    </div>
  );
}

export function ModuleCanvas({ tab, children }: { tab: SuperAdminNavId; children: ReactNode }) {
  const t = TAB_THEME[tab];
  return (
    <div
      className="rounded-sm border border-[#d0d5da] p-3 sm:p-4"
      style={{ backgroundColor: t.soft, backgroundImage: t.pattern }}
    >
      {children}
    </div>
  );
}

export function SearchBar({
  accent,
  value,
  onChange,
  onSubmit,
  placeholder,
  filter,
}: {
  accent: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  placeholder: string;
  filter?: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="mb-4 flex flex-wrap items-center gap-2 border border-[#e5e5e5] bg-white p-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-[200px] flex-1 border border-[#ddd] bg-[#fafafa] px-3 py-2 text-sm outline-none focus:border-[#999]"
      />
      {filter}
      <button type="submit" className="px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: accent }}>
        Search
      </button>
    </form>
  );
}

export function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
  accent,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  accent?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-40"
      style={{ backgroundColor: danger ? '#da542e' : accent || '#27a9e3' }}
    >
      {children}
    </button>
  );
}

function txt(value: unknown) {
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
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#999]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[#333]">{txt(value)}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-[#eee] bg-[#fafafa] p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#888]">{title}</p>
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

/** Human-readable record viewer — never dumps raw JSON. */
export function DetailPanel({
  title,
  data,
  accent,
  onClose,
}: {
  title: string;
  data: Record<string, unknown>;
  accent: string;
  onClose: () => void;
}) {
  const kind = String(data.kind || '');
  const status = String(data.accountStatus ?? data.status ?? '');
  const email =
    data.email ??
    (data.user && typeof data.user === 'object' ? (data.user as Record<string, unknown>).email : null);
  const phone =
    data.phone ??
    (data.user && typeof data.user === 'object' ? (data.user as Record<string, unknown>).phone : null);
  const profile =
    data.profile && typeof data.profile === 'object' ? (data.profile as Record<string, unknown>) : null;
  const skills = asList(data.skills).length
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
    <section className="overflow-hidden border border-[#e5e5e5] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-white" style={{ backgroundColor: accent }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/75">{title}</p>
          <h2 className="text-lg font-bold">{heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          {status ? <StatusPill status={status} /> : null}
          <button
            type="button"
            className="rounded bg-white/15 px-3 py-1 text-xs font-bold text-white hover:bg-white/25"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid max-h-[32rem] gap-3 overflow-y-auto p-4 md:grid-cols-2">
        <Section title="Overview">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name / title" value={heading} />
            <Field label="Status" value={status || '—'} />
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
            {data.whatsappStatus ? <Field label="WhatsApp" value={data.whatsappStatus} /> : null}
          </div>
        </Section>

        {(kind === 'candidates' || profile) && (
          <Section title="Profile">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Experience level" value={profile?.experienceLevel ?? data.experienceLevel} />
              <Field label="Highest education" value={data.highestEducation ?? profile?.highestEducation} />
              <Field label="Onboarded" value={profile?.onboardingCompleted ?? data.onboardingCompleted} />
            </div>
            {(profile?.about || data.about) && (
              <p className="mt-3 text-sm leading-relaxed text-[#555]">{txt(profile?.about ?? data.about)}</p>
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

        {(kind === 'jobs' || employer || data.description) && (
          <Section title="Job info">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company" value={employer?.companyName ?? data.companyName} />
              <Field label="City" value={data.city} />
              <Field label="Applications" value={data.applications} />
              <Field label="Published" value={data.publishedAt} />
            </div>
            {data.description ? (
              <p className="mt-3 max-h-28 overflow-auto text-xs leading-relaxed text-[#555]">{txt(data.description)}</p>
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
                <span
                  key={String(s.id ?? s.name ?? i)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                  style={{ backgroundColor: accent }}
                >
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
                <li key={String(row.id ?? i)} className="border-b border-[#eee] pb-2 text-sm last:border-0">
                  <p className="font-semibold text-[#333]">{txt(row.qualification)}</p>
                  <p className="text-xs text-[#666]">
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
                <li key={String(row.id ?? i)} className="border-b border-[#eee] pb-2 text-sm last:border-0">
                  <p className="font-semibold text-[#333]">{txt(row.jobTitle)}</p>
                  <p className="text-xs font-medium text-[#555]">{txt(row.company)}</p>
                  {row.description ? <p className="mt-1 text-xs text-[#666]">{txt(row.description)}</p> : null}
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
                  className="flex items-center justify-between gap-2 border-b border-[#eee] pb-2 text-xs last:border-0"
                >
                  <span className="font-semibold text-[#333]">{txt(row.title)}</span>
                  <span className="text-[#888]">
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
                  <span className="text-[#444]">
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
                <li key={String(row.id ?? i)} className="text-xs text-[#555]">
                  <p className="font-semibold text-[#333]">
                    {txt(row.jobTitle)} · {txt(row.companyName)}
                  </p>
                  <p className="mt-1 text-[#777]">{txt(row.scheduledAt)}</p>
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
                  <span className="font-semibold text-[#333]">{txt(row.title)}</span>
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
                  <span className="text-[#444]">
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
                <li key={String(row.id ?? i)} className="border-b border-[#eee] pb-2 text-xs last:border-0">
                  <p className="font-semibold text-[#333]">{txt(row.action)}</p>
                  <p className="text-[#777]">
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
