'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EmployerDashboard, EmployerProfile } from '@careerbridge/shared';
import { getEmployerDashboard, getEmployerMe, listEmployerJobs } from '@/lib/api';
import { EmployerShell } from '@/components/EmployerPortal';
import { BrandMascot } from '@/components/BrandMascot';
import { StatusBadge } from '@/components/AppNav';

type JobSummary = { id: string; title: string; city: string; status: string };

function DashboardSkeleton() {
  return (
    <div className="cb-portal-page">
      <div className="cb-portal-wrap">
        <p className="text-sm text-muted">Loading recruiter dashboard...</p>
      </div>
    </div>
  );
}

export default function EmployerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<EmployerDashboard | null>(null);
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
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
        const [dashboard, jobList] = await Promise.all([
          getEmployerDashboard(),
          listEmployerJobs().catch(() => [] as JobSummary[]),
        ]);
        setData(dashboard);
        setJobs(jobList.slice(0, 6));
      })
      .catch(() => router.replace('/login?role=employer'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !data || !profile) return <DashboardSkeleton />;

  const metrics = [
    { label: 'Open jobs', value: data.openJobs, href: '/employer/jobs' },
    { label: 'Applications', value: data.applications, href: '/employer/applications' },
    { label: 'Shortlisted', value: data.shortlisted, href: '/employer/applications' },
    { label: 'Interviews', value: data.interviews, href: '/employer/applications' },
  ];

  return (
    <EmployerShell profile={profile}>
      <section className="cb-mascot-panel relative overflow-hidden p-5 sm:p-6">
        <span className="cb-mascot-panel__glow" aria-hidden />
        <div className="relative z-10 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-sm font-semibold text-[#eab308]">Recruiter workspace</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Hiring dashboard
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/75 sm:text-base">
              {profile.companyName}
              {profile.city ? ` · ${profile.city}` : ''}
              {profile.industry ? ` · ${profile.industry}` : ''}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Link
                href="/employer/jobs/new"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#ca8a04] to-[#eab308] px-5 py-2.5 text-sm font-bold text-navy shadow-[0_12px_28px_rgba(202,138,4,0.28)] transition hover:brightness-110"
              >
                Create job
              </Link>
              <Link
                href="/employer/applications"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/16"
              >
                Review applicants
              </Link>
            </div>
          </div>
          <BrandMascot pose="laptop" motion="float" size="lg" priority className="shrink-0" />
        </div>

        {profile.verificationStatus === 'PENDING' ? (
          <div className="relative z-10 mt-4 rounded-2xl border border-[#eab308]/50 bg-black/20 px-4 py-3 text-sm text-white">
            Company verification is pending review. You can prepare jobs while we confirm your
            affiliation.
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((item, index) => (
          <Link
            key={item.label}
            href={item.href}
            className="cb-lift-card relative block overflow-hidden p-4 sm:p-5"
          >
            {index === 0 ? (
              <BrandMascot
                pose="target"
                motion="pulse"
                size="sm"
                className="pointer-events-none absolute -right-1 -top-1 opacity-95"
              />
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted sm:text-sm">
              {item.label}
            </p>
            <p className="mt-2 text-3xl font-extrabold text-primary">{item.value}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="cb-dash-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-primary">Recent applications</h2>
            <Link href="/employer/applications" className="text-sm font-semibold text-accent hover:text-teal">
              View all
            </Link>
          </div>

          {data.recent.length === 0 ? (
            <div className="cb-mascot-empty mt-3 rounded-2xl border border-dashed border-primary/15 bg-fog/60">
              <BrandMascot pose="run" motion="run" size="md" />
              <p className="font-semibold text-primary">No applications yet</p>
              <p className="max-w-sm text-sm text-muted">
                Publish a job and candidates will start showing up here.
              </p>
              <Link
                href="/employer/jobs/new"
                className="mt-1 inline-flex rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-accent"
              >
                Create your first job
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {data.recent.map((item) => (
                <Link
                  key={item.applicationId}
                  href={`/employer/jobs/${item.jobId}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-primary/8 bg-fog/40 px-4 py-3 transition hover:border-teal/40 hover:bg-white"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary">{item.candidateName}</p>
                    <p className="truncate text-sm text-muted">{item.jobTitle}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="cb-dash-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-primary">Your jobs</h2>
            <Link href="/employer/jobs" className="text-sm font-semibold text-accent hover:text-teal">
              Manage
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="cb-mascot-empty mt-3 rounded-2xl border border-dashed border-primary/15 bg-fog/60">
              <BrandMascot pose="checklist" motion="pop" size="md" />
              <p className="font-semibold text-primary">No jobs posted</p>
              <p className="max-w-sm text-sm text-muted">Create a role to start matching candidates.</p>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2 md:hidden">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/employer/jobs/${job.id}`}
                    className="block rounded-2xl border border-primary/8 bg-fog/40 px-4 py-3 transition hover:border-teal/40 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-primary">{job.title}</p>
                        <p className="text-sm text-muted">{job.city}</p>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-4 hidden overflow-hidden rounded-2xl border border-primary/8 md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-fog/80 text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">City</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="border-t border-primary/8 bg-white hover:bg-fog/40">
                        <td className="px-4 py-3">
                          <Link href={`/employer/jobs/${job.id}`} className="font-semibold text-primary hover:text-teal">
                            {job.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted">{job.city}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={job.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </EmployerShell>
  );
}
