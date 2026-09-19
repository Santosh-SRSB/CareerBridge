'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  EmployerApplication,
  EmployerDashboard,
  EmployerInterviewRecord,
  EmployerProfile,
} from '@careerbridge/shared';
import {
  getEmployerDashboard,
  getEmployerMe,
  listAllEmployerApplications,
  listEmployerInterviews,
} from '@/lib/api';
import { EmployerShell, TinyEagleIcon } from '@/components/EmployerPortal';

function greetingLabel(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatInterviewWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: '—', time: '—' };
  return {
    day: date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
  };
}

function PerformanceChart({
  series,
}: {
  series: Array<{ label: string; count: number }>;
}) {
  const bars = useMemo(() => {
    const rows =
      series.length > 0
        ? series
        : Array.from({ length: 6 }, () => ({ label: '—', count: 0 }));
    const max = Math.max(...rows.map((row) => row.count), 0);
    return rows.map((row) => ({
      ...row,
      heightPct: max > 0 ? Math.max(8, Math.round((row.count / max) * 100)) : 8,
    }));
  }, [series]);

  const total = bars.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="ep-saas-bars-wrap">
      <div
        className="ep-saas-bars"
        role="img"
        aria-label={
          total > 0
            ? `Applications over the last six months: ${bars.map((b) => `${b.label} ${b.count}`).join(', ')}`
            : 'No applications in the last six months'
        }
      >
        {bars.map((bar) => (
          <div key={`${bar.label}-${bar.count}`} className="ep-saas-bars__col" title={`${bar.label}: ${bar.count}`}>
            <span className="ep-saas-bars__value">{bar.count}</span>
            <div className="ep-saas-bars__plot">
              <div className="ep-saas-bars__bar" style={{ height: `${bar.heightPct}%` }} />
            </div>
            <span className="ep-saas-bars__label">{bar.label}</span>
          </div>
        ))}
      </div>
      <p className="ep-saas-bars__caption">
        {total > 0
          ? `${total} application${total === 1 ? '' : 's'} in the last 6 months`
          : 'Applications will appear here as candidates apply'}
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="ep-app ep-app--desk ep-app--saas ep-app--leftnav">
      <div className="ep-main">
        <div className="ep-content">
          <div className="ep-saas-dash ep-saas-dash--loading" aria-busy="true">
            <div className="ep-saas-skel ep-saas-skel--lg" />
            <div className="ep-saas-skel-row">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="ep-saas-skel ep-saas-skel--card" />
              ))}
            </div>
            <div className="ep-saas-skel-grid">
              <div className="ep-saas-skel ep-saas-skel--panel" />
              <div className="ep-saas-skel ep-saas-skel--panel" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  {
    href: '/employer/jobs/new',
    title: 'Post a Job',
    copy: 'Publish a new opening',
    key: 'post',
  },
  {
    href: '/employer/candidates',
    title: 'Find Candidates',
    copy: 'Browse matched talent',
    key: 'find',
  },
  {
    href: '/employer/interviews/schedule',
    title: 'Schedule Interview',
    copy: 'Book time with talent',
    key: 'schedule',
  },
  {
    href: '/employer/applications',
    title: 'View Applications',
    copy: 'Review your pipeline',
    key: 'apps',
  },
] as const;

export default function EmployerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<EmployerDashboard | null>(null);
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [interviews, setInterviews] = useState<EmployerInterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        const [dash, appRows, interviewRows] = await Promise.all([
          getEmployerDashboard(),
          listAllEmployerApplications().catch(() => [] as EmployerApplication[]),
          listEmployerInterviews().catch(() => [] as EmployerInterviewRecord[]),
        ]);
        setData(dash);
        setApplications(appRows);
        setInterviews(interviewRows);
      })
      .catch(() => router.replace('/login?role=employer'))
      .finally(() => setLoading(false));
  }, [router]);

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

  if (loading || !data || !profile) {
    return <DashboardSkeleton />;
  }

  const companyLabel = profile.companyName?.trim() || 'your company';

  const metrics = [
    { label: 'Active Jobs', value: data.openJobs, href: '/employer/jobs' },
    { label: 'Total Applicants', value: data.applications, href: '/employer/applications' },
    { label: 'Shortlisted', value: data.shortlisted, href: '/employer/applications' },
    { label: 'Interviews Scheduled', value: data.interviews, href: '/employer/interviews' },
    { label: 'Hired Candidates', value: hiredCount, href: '/employer/applications' },
  ] as const;

  return (
    <EmployerShell profile={profile}>
      <div className="ep-saas-dash">
        <div className="ep-saas-dash__stage">
          <aside className="ep-saas-hinge" aria-label="Welcome">
            <span className="ep-saas-hinge__nail" aria-hidden />
            <div className="ep-saas-hinge__swing">
              <div className="ep-saas-hinge__board">
                <TinyEagleIcon className="ep-saas-hinge__eagle" size={12} />
                <strong>Welcome to Employer Dashboard</strong>
              </div>
            </div>
          </aside>

          <header className="ep-saas-dash__welcome">
            <div className="ep-saas-dash__welcome-copy">
              <p className="ep-saas-dash__eyebrow" aria-hidden>
                Employer workspace
              </p>
              <h1 className="ep-saas-dash__title">
                <span className="ep-saas-dash__write ep-saas-dash__write--greet">
                  {greetingLabel()},
                </span>{' '}
                <span className="ep-saas-dash__write ep-saas-dash__write--name">{companyLabel}</span>
                <span className="ep-saas-dash__caret" aria-hidden />
              </h1>
              <p className="ep-saas-dash__sub ep-saas-dash__sub--process" aria-label="Hiring process">
                <span className="ep-saas-dash__process-label">Hiring process</span>
                <span className="ep-saas-dash__write ep-saas-dash__write--flow">
                  Post job → See candidates → Check ATS → Select candidates → Interview → Hired
                </span>
              </p>
            </div>
          </header>

          <div className="ep-saas-dash__cluster ep-saas-dash__cluster--right">
            <Link href="/employer/jobs/new" className="ep-saas-btn ep-saas-btn--primary ep-saas-btn--sm">
              + Post a job
            </Link>
            <aside className="ep-saas-guide" aria-label="Hiring steps guide">
              <div className="ep-saas-guide__tips" aria-live="polite">
                <p className="ep-saas-guide__tip ep-saas-guide__tip--1">1. Post your job</p>
                <p className="ep-saas-guide__tip ep-saas-guide__tip--2">2. See candidates</p>
                <p className="ep-saas-guide__tip ep-saas-guide__tip--3">3. Check ATS & select</p>
                <p className="ep-saas-guide__tip ep-saas-guide__tip--4">4. Interview → Hire</p>
              </div>
              <div className="ep-saas-guide__girl" aria-hidden>
                <svg viewBox="0 0 128 168" fill="none">
                  {/* raised pointing arm */}
                  <path
                    className="ep-saas-guide__arm"
                    d="M82 78c16-16 26-30 28-44"
                    stroke="#f0c4a8"
                    strokeWidth="6.5"
                    strokeLinecap="round"
                  />
                  <circle
                    className="ep-saas-guide__hand"
                    cx="110"
                    cy="32"
                    r="6.5"
                    fill="#f0c4a8"
                    stroke="#0c332c"
                    strokeWidth="1.4"
                  />
                  {/* neat bun + professional hair */}
                  <circle cx="58" cy="22" r="9" fill="#2a1a12" />
                  <ellipse cx="58" cy="40" rx="20" ry="22" fill="#2a1a12" />
                  {/* face */}
                  <circle cx="58" cy="44" r="15" fill="#f0c4a8" stroke="#0c332c" strokeWidth="1.5" />
                  <circle cx="52" cy="42" r="1.5" fill="#0c332c" />
                  <circle cx="64" cy="42" r="1.5" fill="#0c332c" />
                  <path d="M53 50c2 2.2 8 2.2 10 0" stroke="#0c332c" strokeWidth="1.3" strokeLinecap="round" />
                  {/* blazer + blouse */}
                  <path
                    d="M40 70c1 26 6 42 18 42s17-16 18-42c-5 4-11 6-18 6s-13-2-18-6Z"
                    fill="#0c332c"
                    stroke="#0c332c"
                    strokeWidth="1.4"
                  />
                  <path d="M50 72c2.5 10 5 16 8 16s5.5-6 8-16c-2.5 2-5.5 3-8 3s-5.5-1-8-3Z" fill="#f6f4ef" />
                  <path d="M58 72v16" stroke="#1f9d8a" strokeWidth="1.2" />
                  {/* lapels */}
                  <path d="M42 72l10 8-4-10" fill="#144039" stroke="#0c332c" strokeWidth="1" />
                  <path d="M74 72l-10 8 4-10" fill="#144039" stroke="#0c332c" strokeWidth="1" />
                  {/* resting arm */}
                  <path d="M40 78c-11 12-13 24-11 32" stroke="#f0c4a8" strokeWidth="5.5" strokeLinecap="round" />
                  {/* pencil skirt */}
                  <path
                    d="M42 110h32l5 34H37l5-34Z"
                    fill="#1a3d36"
                    stroke="#0c332c"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path d="M48 112h20" stroke="#1f9d8a" strokeWidth="1.2" opacity="0.7" />
                  {/* legs + heels */}
                  <path d="M50 144v12M66 144v12" stroke="#f0c4a8" strokeWidth="3.2" strokeLinecap="round" />
                  <path d="M46 156h10l-1 4H45l1-4Z" fill="#0c332c" />
                  <path d="M62 156h10l-1 4H61l1-4Z" fill="#0c332c" />
                </svg>
              </div>
            </aside>
          </div>
        </div>

        <section className="ep-saas-metrics" aria-label="Overview statistics">
          {metrics.map((item) => (
            <Link key={item.label} href={item.href} className="ep-saas-metric">
              <span className="ep-saas-metric__label">{item.label}</span>
              <p className="ep-saas-metric__value">{item.value}</p>
            </Link>
          ))}
        </section>

        <section className="ep-saas-quick" aria-label="Quick actions">
          {QUICK_ACTIONS.map((item) => (
            <Link key={item.key} href={item.href} className="ep-saas-quick__card">
              <strong>
                <TinyEagleIcon className="ep-saas-quick__eagle" size={11} />
                {item.title}
              </strong>
              <span>{item.copy}</span>
            </Link>
          ))}
        </section>

        <div className="ep-saas-grid">
          <section className="ep-saas-panel" aria-labelledby="perf-title">
            <div className="ep-saas-panel__head">
              <div>
                <h2 id="perf-title">Recruitment performance</h2>
              </div>
            </div>
            <PerformanceChart series={data.applicationsByMonth || []} />
          </section>

          <section className="ep-saas-panel" aria-labelledby="interviews-title">
            <div className="ep-saas-panel__head">
              <div>
                <h2 id="interviews-title">Upcoming interviews</h2>
              </div>
            </div>
            {upcomingInterviews.length === 0 ? (
              <div className="ep-saas-empty">
                <p>No interviews scheduled</p>
              </div>
            ) : (
              <ul className="ep-saas-interview-list">
                {upcomingInterviews.map((row) => {
                  const when = formatInterviewWhen(row.scheduledAt);
                  const name =
                    [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ') || 'Candidate';
                  return (
                    <li key={row.id}>
                      <div className="ep-saas-interview__when">
                        <strong>{when.day}</strong>
                        <em>{when.time}</em>
                      </div>
                      <div className="ep-saas-interview__body">
                        <strong>{name}</strong>
                        <span>{row.job.title}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </EmployerShell>
  );
}
