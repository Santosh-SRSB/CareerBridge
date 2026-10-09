'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  EmployerApplication,
  EmployerDashboard,
  EmployerInterviewRecord,
  EmployerJobSummary,
  EmployerProfile,
} from '@careerbridge/shared';
import {
  getEmployerDashboard,
  getEmployerMe,
  listAllEmployerApplications,
  listEmployerInterviews,
  listEmployerJobs,
} from '@/lib/api';
import { EmployerShell, EmployerShellSkeleton, useEmployerShell } from '@/components/EmployerPortal';
import {
  EvApplicationPill,
  EvAvatar,
  EvEmpty,
  EvInterviewPill,
  EvJobStatus,
  EvMatch,
  EvStat,
} from '@/components/employer/ui';
import { TestimonialPromptCard } from '@/components/TestimonialPromptCard';
import { ErrorState } from '@/components/ui/StateViews';
import { isUnauthorizedError } from '@/lib/client-errors';

const HERO_SLIDES = [
  { src: '/employer/hero-1.jpg', position: '50% 0%' },
  { src: '/employer/hero-2.jpg', position: '50% 3%' },
  { src: '/employer/hero-3.jpg', position: '50% 14%' },
] as const;

const MOVE_NEXT = [
  { href: '/employer/jobs/new', label: 'Post a job' },
  { href: '/employer/candidates', label: 'Review candidates' },
  { href: '/employer/interviews/schedule', label: 'Schedule interview' },
  { href: '/employer/reports', label: 'See analytics' },
] as const;

function greetingLabel(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatInterviewWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}

function candidateName(person: { firstName: string | null; lastName: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Candidate';
}

function DashboardHero({ companyLabel }: { companyLabel: string }) {
  const shell = useEmployerShell();
  const [slide, setSlide] = useState(0);
  const unread = shell?.unreadCount ?? 0;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="ev-hero" aria-label="Welcome">
      <div className="ev-hbar">
        <Link
          href="/notifications"
          className="ev-pillbtn"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unread > 0 ? <span className="ev-badge">{unread > 99 ? '99+' : unread}</span> : null}
        </Link>
        {shell ? (
          <button type="button" className="ev-pillbtn ev-pillbtn--lo" onClick={() => shell.signOut()}>
            {shell.impersonating ? 'Exit to admin' : 'Logout'}
          </button>
        ) : null}
      </div>
      <div className="ev-hero-art" aria-hidden>
        {HERO_SLIDES.map((item, index) => (
          <Image
            key={item.src}
            src={item.src}
            alt=""
            width={900}
            height={1100}
            priority={index === 0}
            className={index === slide ? 'on' : undefined}
            style={{ objectPosition: item.position }}
          />
        ))}
      </div>
      <div className="ev-hero-in">
        <small>
          {greetingLabel()}, {companyLabel}
        </small>
        <h1>
          Find the next strong hire. This week.
          <span className="ev-caret" aria-hidden />
        </h1>
        <p>Skills, experience, or location — shortlist from the people who already applied, then book an interview.</p>
        <Link href="/employer/jobs/new" className="ev-btn ev-btn--amber">
          Post a job
        </Link>
      </div>
      <div className="ev-dots">
        {HERO_SLIDES.map((item, index) => (
          <button
            key={item.src}
            type="button"
            className={index === slide ? 'on' : undefined}
            aria-label={`Show image ${index + 1}`}
            aria-pressed={index === slide}
            onClick={() => setSlide(index)}
          />
        ))}
      </div>
    </section>
  );
}

function HiringOverview({ applications, jobs }: { applications: EmployerApplication[]; jobs: EmployerJobSummary[] }) {
  const [range, setRange] = useState<6 | 12>(6);
  const [jobId, setJobId] = useState('');

  const rows = useMemo(() => {
    const since = new Date();
    since.setMonth(since.getMonth() - range);
    const scoped = applications.filter((a) => {
      if (jobId && a.job.id !== jobId) return false;
      const created = new Date(a.createdAt);
      return Number.isNaN(created.getTime()) || created >= since;
    });
    const total = scoped.length;
    const count = (statuses: string[]) => scoped.filter((a) => statuses.includes(a.status)).length;
    return [
      { label: 'Applications', value: total },
      { label: 'Shortlisted', value: count(['SHORTLISTED']) },
      { label: 'Interviews', value: count(['INTERVIEW']) },
      { label: 'Hired', value: count(['HIRED', 'SELECTED']) },
    ].map((row) => ({ ...row, pct: total > 0 ? Math.max(3, Math.round((row.value / total) * 100)) : 3 }));
  }, [applications, jobId, range]);

  return (
    <div className="ev-card ev-mt">
      <h2>3. Hiring overview</h2>
      <div className="ev-tabs">
        <button type="button" className={`ev-tab${range === 6 ? ' on' : ''}`} aria-pressed={range === 6} onClick={() => setRange(6)}>
          6 months
        </button>
        <button type="button" className={`ev-tab${range === 12 ? ' on' : ''}`} aria-pressed={range === 12} onClick={() => setRange(12)}>
          1 year
        </button>
        <span className="ev-form">
          <select aria-label="Filter by job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">All Jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.label}>
          <div className="ev-row ev-row--flat">
            <span>{row.label}</span>
            <b>{row.value}</b>
          </div>
          <div className="ev-bar">
            <i style={{ width: `${row.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EmployerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<EmployerDashboard | null>(null);
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [interviews, setInterviews] = useState<EmployerInterviewRecord[]>([]);
  const [jobs, setJobs] = useState<EmployerJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setLoadFailed(false);
    getEmployerMe()
      .then(async (employer) => {
        if (employer.verificationStatus === 'UNVERIFIED') {
          router.replace('/employer/kyc');
          return;
        }
        if (employer.verificationStatus === 'KYC_COMPLETE') {
          router.replace('/employer/verify');
          return;
        }
        setProfile(employer);
        const [dash, appRows, interviewRows, jobRows] = await Promise.all([
          getEmployerDashboard(),
          listAllEmployerApplications().catch(() => [] as EmployerApplication[]),
          listEmployerInterviews().catch(() => [] as EmployerInterviewRecord[]),
          listEmployerJobs().catch(() => [] as EmployerJobSummary[]),
        ]);
        setData(dash);
        setApplications(appRows);
        setInterviews(interviewRows);
        setJobs(jobRows);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) {
          router.replace('/login?role=employer');
          return;
        }
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [router, reloadKey]);

  const hiredCount = useMemo(
    () => applications.filter((a) => a.status === 'HIRED' || a.status === 'SELECTED').length,
    [applications],
  );

  const upcomingInterviews = useMemo(
    () =>
      interviews
        .filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status))
        .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
        .slice(0, 4),
    [interviews],
  );

  const recentApplications = useMemo(
    () => [...applications].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8),
    [applications],
  );

  const openRoles = useMemo(
    () =>
      [...jobs]
        .filter((job) => job.status !== 'CLOSED')
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 5),
    [jobs],
  );

  if (!loading && loadFailed) {
    const retry = <ErrorState onRetry={() => setReloadKey((k) => k + 1)} className="m-6" />;
    return profile ? <EmployerShell profile={profile}>{retry}</EmployerShell> : retry;
  }

  if (loading || !data || !profile) {
    return <EmployerShellSkeleton />;
  }

  const isNewEmployer = data.openJobs === 0 && data.applications === 0 && data.interviews === 0;
  const companyLabel = profile.companyName?.trim() || 'your company';
  const months = data.applicationsByMonth || [];
  const thisMonth = months.length ? months[months.length - 1].count : null;
  const viewsByJob = new Map((data.jobPerformance || []).map((row) => [row.jobId, row.views]));
  const shortlistPct = data.applications > 0 ? Math.round((data.shortlisted / data.applications) * 100) : 0;

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/employer/candidates?q=${encodeURIComponent(q)}` : '/employer/candidates');
  }

  return (
    <EmployerShell profile={profile} bleed>
      <DashboardHero companyLabel={companyLabel} />

      <form className="ev-search" role="search" onSubmit={onSearch}>
        <span aria-hidden>&#9906;</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidates, skills, locations..."
          aria-label="Search candidates"
        />
        <button type="submit">Search</button>
      </form>

      <div className="ev-pad">
        <TestimonialPromptCard audience="EMPLOYER" />

        {isNewEmployer ? (
          <div className="ev-card ev-mt">
            <EvEmpty
              title="Welcome! Create your first job to start receiving applications."
              body="Post a job and CareerBridge will match it with candidates from your area."
              action={
                <Link href="/employer/jobs/new" className="ev-btn">
                  Create Job
                </Link>
              }
            />
          </div>
        ) : null}

        <section className="ev-grid ev-g5 ev-mt" aria-label="Overview statistics">
          <EvStat
            label="Active Jobs"
            value={data.openJobs}
            hint={`${data.openJobs} role${data.openJobs === 1 ? '' : 's'} open`}
            icon="▤"
            href="/employer/jobs"
          />
          <EvStat
            label="Total Applicants"
            value={data.applications}
            hint={thisMonth == null ? 'All applications' : `${thisMonth} this month`}
            icon="☺"
            href="/employer/applications"
          />
          <EvStat
            label="Shortlisted"
            value={data.shortlisted}
            hint={`${shortlistPct}% of applicants`}
            icon="☆"
            href="/employer/applications"
          />
          <EvStat
            label="Interviews"
            value={data.interviews}
            hint={upcomingInterviews.length ? `${upcomingInterviews.length} upcoming` : 'None scheduled'}
            icon="▥"
            href="/employer/interviews"
          />
          <EvStat label="Hired" value={hiredCount} hint="Offers come next" icon="✓" href="/employer/applications" />
        </section>

        <div className="ev-grid ev-g2 ev-mt">
          <div className="ev-card">
            <div className="ev-card-head">
              <h2>1. Open roles</h2>
              <Link href="/employer/jobs" className="ev-lnk">
                View all
              </Link>
            </div>
            {openRoles.length === 0 ? (
              <EvEmpty
                title="No open roles"
                body="Post a job to start receiving applicants."
                action={
                  <Link href="/employer/jobs/new" className="ev-btn">
                    Post a job
                  </Link>
                }
              />
            ) : (
              openRoles.map((job, index) => (
                <Link key={job.id} href={`/employer/jobs/${job.id}`} className="ev-row" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="ev-row-main">
                    <span className="ev-num">{index + 1}</span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ color: 'var(--ev-ink)' }}>{job.title}</b>
                      <br />
                      <span className="ev-sub">
                        {job.city || '—'} ·{' '}
                        {job.status === 'DRAFT'
                          ? 'Draft'
                          : `${job.applicantCount} applicant${job.applicantCount === 1 ? '' : 's'}`}
                        {viewsByJob.has(job.id) ? ` · ${viewsByJob.get(job.id)} views` : ''}
                      </span>
                    </span>
                  </span>
                  <EvJobStatus status={job.status} />
                </Link>
              ))
            )}
          </div>

          <div className="ev-card">
            <div className="ev-card-head">
              <h2>2. Upcoming interview{upcomingInterviews.length > 1 ? 's' : ''}</h2>
              {upcomingInterviews.length ? (
                <Link href="/employer/interviews" className="ev-lnk">
                  View all
                </Link>
              ) : null}
            </div>
            {upcomingInterviews.length === 0 ? (
              <EvEmpty
                title="No interviews yet"
                body="Shortlist an applicant, then book a time."
                action={
                  <Link href="/employer/interviews/schedule" className="ev-btn">
                    Open schedule
                  </Link>
                }
              />
            ) : (
              upcomingInterviews.map((row) => (
                <div key={row.id} className="ev-row">
                  <span className="ev-row-main">
                    <EvAvatar name={candidateName(row.candidate)} size="sm" />
                    <span style={{ minWidth: 0 }}>
                      <b style={{ color: 'var(--ev-ink)' }}>{candidateName(row.candidate)}</b>
                      <br />
                      <span className="ev-sub">
                        {row.job.title} · {formatInterviewWhen(row.scheduledAt)}
                      </span>
                    </span>
                  </span>
                  <EvInterviewPill status={row.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <HiringOverview applications={applications} jobs={jobs} />

        <div className="ev-card ev-mt">
          <div className="ev-card-head">
            <h2>4. Recent applications</h2>
            <Link href="/employer/applications" className="ev-lnk">
              View all
            </Link>
          </div>
          {recentApplications.length === 0 && (data.recent?.length ?? 0) === 0 ? (
            <EvEmpty
              title="No applications yet"
              action={
                <Link href="/employer/jobs/new" className="ev-btn">
                  Post a job
                </Link>
              }
            />
          ) : (
            <div className="ev-scroll">
              <table className="ev-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Job</th>
                    <th>Percentage matched</th>
                    <th>Skills</th>
                    <th>Status</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {recentApplications.length
                    ? recentApplications.map((row) => {
                        const name = candidateName(row.candidate);
                        const skills = row.candidate.skills || [];
                        return (
                          <tr key={row.id}>
                            <td>
                              <span className="ev-who">
                                <EvAvatar name={name} size="sm" />
                                <b>{name}</b>
                              </span>
                            </td>
                            <td>{row.job.title}</td>
                            <td>
                              <EvMatch score={row.match?.score} />
                            </td>
                            <td>
                              {skills.length ? `${skills.slice(0, 3).join(', ')}${skills.length > 3 ? ` +${skills.length - 3}` : ''}` : '—'}
                            </td>
                            <td>
                              <EvApplicationPill status={row.status} />
                            </td>
                            <td>
                              <Link
                                href={`/employer/candidates/${row.candidate.id}?jobId=${encodeURIComponent(row.job.id)}&from=applications`}
                                className="ev-btn ev-btn--ghost ev-btn--sm"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    : data.recent.slice(0, 8).map((row) => (
                        <tr key={row.applicationId}>
                          <td>
                            <span className="ev-who">
                              <EvAvatar name={row.candidateName} size="sm" />
                              <b>{row.candidateName}</b>
                            </span>
                          </td>
                          <td>{row.jobTitle}</td>
                          <td>—</td>
                          <td>—</td>
                          <td>
                            <EvApplicationPill status={row.status} />
                          </td>
                          <td>
                            <Link
                              href={
                                row.candidateId
                                  ? `/employer/candidates/${row.candidateId}?jobId=${encodeURIComponent(row.jobId || '')}&from=applications`
                                  : `/employer/applications?jobId=${encodeURIComponent(row.jobId || '')}`
                              }
                              className="ev-btn ev-btn--ghost ev-btn--sm"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ev-card ev-mt">
          <h2>5. Move next</h2>
          <div className="ev-grid ev-g4">
            {MOVE_NEXT.map((item, index) => (
              <Link key={item.href} href={item.href} className="ev-btn ev-btn--ghost ev-move">
                <span className="ev-num">{index + 1}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <p className="ev-foot">© {new Date().getFullYear()} CareerBridge by SRSB Workforce Solutions Pvt. Ltd.</p>
      </div>
    </EmployerShell>
  );
}
