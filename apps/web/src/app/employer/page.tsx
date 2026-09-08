'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EmployerDashboard, EmployerProfile } from '@careerbridge/shared';
import { getEmployerDashboard, getEmployerMe } from '@/lib/api';
import { EmployerShell } from '@/components/EmployerPortal';

function applicationStatusLabel(status: string) {
  if (status === 'SHORTLISTED') return 'Shortlisted';
  if (status === 'INTERVIEW') return 'Interview';
  if (status === 'APPLIED') return 'Applied';
  if (status === 'REVIEW') return 'In review';
  if (status === 'SELECT') return 'Selected';
  if (status === 'HIRE') return 'Hired';
  if (status === 'REJECT') return 'Not selected';
  return status.replaceAll('_', ' ');
}

function DashboardSkeleton() {
  return (
    <div className="ep-app ep-app--desk">
      <div className="ep-main">
        <div className="ep-content">
          <div className="ep-dash ep-dash--loading">
            <div className="ep-skel ep-skel--title" />
            <div className="ep-skel ep-skel--sub" />
            <div className="ep-dash__metrics">
              <div className="ep-skel ep-skel--card" />
              <div className="ep-skel ep-skel--card" />
              <div className="ep-skel ep-skel--card" />
              <div className="ep-skel ep-skel--card" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: '/employer/jobs/new', title: 'Create job', copy: 'Post a new opening', tone: 'teal', icon: 'plus' },
  { href: '/employer/candidates', title: 'Search candidates', copy: 'Find ranked matches', tone: 'green', icon: 'search' },
  { href: '/employer/applications', title: 'Applications', copy: 'Review inbound talent', tone: 'amber', icon: 'file' },
  { href: '/employer/interviews', title: 'Interviews', copy: 'Schedule & track', tone: 'blue', icon: 'cal' },
  { href: '/employer/jobs', title: 'Manage jobs', copy: 'Pause, edit, close', tone: 'forest', icon: 'edit' },
  { href: '/employer/reports', title: 'Reports', copy: 'Hiring insights', tone: 'slate', icon: 'chart' },
  { href: '/employer/profile', title: 'Company profile', copy: 'Update company details', tone: 'mint', icon: 'user' },
] as const;

function WorkspaceIcon({ name }: { name: string }) {
  if (name === 'plus') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (name === 'search') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4-4" />
      </svg>
    );
  }
  if (name === 'file') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M6 2h9l5 5v15H6z" />
        <path d="M14 2v5h5" />
      </svg>
    );
  }
  if (name === 'cal') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18" />
      </svg>
    );
  }
  if (name === 'edit') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
        <path d="M18 2l4 4-11 11H7v-4z" />
      </svg>
    );
  }
  if (name === 'chart') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-5 3 3 5-7" />
      </svg>
    );
  }
  if (name === 'card') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
}

type MetricTone = 'teal' | 'green' | 'amber' | 'blue';

export default function EmployerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<EmployerDashboard | null>(null);
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
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
        setData(await getEmployerDashboard());
      })
      .catch(() => router.replace('/login?role=employer'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !data || !profile) {
    return <DashboardSkeleton />;
  }

  const companyLabel = profile.companyName?.trim() || 'your company';
  const greetName = profile.contactName?.trim() || companyLabel;

  const metrics: Array<{ label: string; value: number; href: string; tone: MetricTone }> = [
    { label: 'Active jobs', value: data.openJobs, href: '/employer/jobs', tone: 'teal' },
    { label: 'Applications', value: data.applications, href: '/employer/applications', tone: 'green' },
    { label: 'Shortlisted', value: data.shortlisted, href: '/employer/applications', tone: 'amber' },
    { label: 'Interviews', value: data.interviews, href: '/employer/interviews', tone: 'blue' },
  ];

  return (
    <EmployerShell profile={profile}>
      <div className="ep-dash">
        <header className="ep-dash__hello">
          <div>
            <p className="ep-dash__eyebrow">Home · Dashboard</p>
            <h1 className="ep-dash__title">
              Hello, <span className="ep-dash__type">{greetName}</span>
            </h1>
            <p className="ep-dash__sub">Here&apos;s what&apos;s happening for {companyLabel} today.</p>
          </div>
          <Link href="/employer/jobs/new" className="ep-dash__create">
            + Create job
          </Link>
        </header>

        <section className="ep-dash__metrics" aria-label="Key metrics">
          {metrics.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`ep-dash__metric ep-dash__metric--${item.tone}`}
            >
              <div className="ep-dash__metric-ico" aria-hidden>
                {item.tone === 'teal' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <rect x="3" y="7" width="18" height="13" rx="2" />
                    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                ) : null}
                {item.tone === 'green' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <path d="M6 2h9l5 5v15H6z" />
                    <path d="M14 2v5h5" />
                  </svg>
                ) : null}
                {item.tone === 'amber' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <path d="M12 2l3 6 6 .9-4.5 4.3 1 6-5.5-3-5.5 3 1-6L3 8.9 9 8z" />
                  </svg>
                ) : null}
                {item.tone === 'blue' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="17" rx="2" />
                    <path d="M3 9h18" />
                  </svg>
                ) : null}
              </div>
              <p className="ep-dash__metric-value">{item.value}</p>
              <p className="ep-dash__metric-label">{item.label}</p>
            </Link>
          ))}
        </section>

        <section className="ep-dash__block" aria-labelledby="hiring-tools-title">
          <div className="ep-dash__block-head">
            <h2 id="hiring-tools-title">Hiring workspace</h2>
            <p>Jump into the tools you use most</p>
          </div>
          <div className="ep-dash__tiles">
            {QUICK_ACTIONS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`ep-dash__tile ep-dash__tile--${item.tone}`}
              >
                <span className="ep-dash__tile-ico" aria-hidden>
                  <WorkspaceIcon name={item.icon} />
                </span>
                <span className="ep-dash__tile-body">
                  <strong>{item.title}</strong>
                  <em>{item.copy}</em>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="ep-dash__block" aria-labelledby="recent-applications-title">
          <div className="ep-dash__block-head">
            <h2 id="recent-applications-title">Recent applications</h2>
            <Link href="/employer/applications" className="ep-dash__underline">
              View all
            </Link>
          </div>

          {data.recent.length === 0 ? (
              <div className="ep-dash__empty-card">
                <div className="ep-dash__empty-ico" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2h9l5 5v15H6z" />
                    <path d="M14 2v5h5" />
                  </svg>
                </div>
                <p className="ep-dash__empty-title">No applications yet</p>
                <p className="ep-dash__empty">Publish a job to start receiving candidates.</p>
              </div>
            ) : (
              <div className="ep-dash__panel">
                <div className="overflow-x-auto">
                <table className="ep-dash-table min-w-[520px]">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Job</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((item) => (
                      <tr key={item.applicationId}>
                        <td>
                          {item.candidateId && item.jobId ? (
                            <Link
                              href={`/employer/candidates/${item.candidateId}?jobId=${encodeURIComponent(item.jobId)}`}
                              className="ep-dash__underline"
                            >
                              {item.candidateName}
                            </Link>
                          ) : (
                            item.candidateName
                          )}
                        </td>
                        <td>{item.jobTitle}</td>
                        <td>
                          <span className="ep-dash__badge">{applicationStatusLabel(item.status)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
        </section>
      </div>
    </EmployerShell>
  );
}
