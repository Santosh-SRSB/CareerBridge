'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { JobDetail } from '@careerbridge/shared';
import { getJob } from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import { formatJobType, formatSalary } from '@/lib/match';
import { CandidateShell } from '@/components/CandidatePortal';
import { Button } from '@/components/ui/Button';
import { MatchBadge } from '@/components/MatchBadge';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJob(params.id)
      .then(setJob)
      .catch(() => setError('This job is no longer available.'));
  }, [params.id]);

  if (error) {
    return (
      <CandidateShell>
        <p className="text-error">{error}</p>
      </CandidateShell>
    );
  }
  if (!job) {
    return (
      <CandidateShell>
        <p className="text-muted">Loading job details...</p>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell>
      <Link href="/jobs" className="text-sm font-bold text-teal hover:underline">
        ← Jobs
      </Link>
      <div className="grid items-start gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <article className="cb-dash-card min-w-0 p-4 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">{formatJobType(job.jobType)}</p>
          <h1 className="mt-2 break-words text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{job.title}</h1>
          <p className="mt-2 text-lg font-semibold text-primary">{job.companyName}</p>
          <p className="text-muted">Verified Employer ✓ · {job.city}</p>
          <p className="mt-3 text-xl font-extrabold text-primary">{formatSalary(job.salaryMin, job.salaryMax)}</p>
          {job.match ? (
            <div className="mt-4">
              <MatchBadge score={job.match.score} />
            </div>
          ) : null}
          <div className="mt-6">
            {job.applied ? (
              <Link
                href="/applications"
                className="inline-flex h-8 items-center rounded-full bg-[#14b8a6] px-3.5 text-xs font-extrabold text-[#0a2e2c]"
              >
                Track Application
              </Link>
            ) : (
              <Button
                onClick={() => {
                  if (!getStoredUser()) {
                    router.push('/login');
                    return;
                  }
                  router.push(`/jobs/${job.id}/apply`);
                }}
              >
                Apply Now
              </Button>
            )}
          </div>
          <section className="mt-8">
            <h2 className="text-lg font-bold text-primary">About the job</h2>
            <p className="mt-3 whitespace-pre-wrap leading-7 text-muted">{job.description}</p>
          </section>
          {job.experience ? (
            <section className="mt-6">
              <h2 className="text-lg font-bold text-primary">Experience</h2>
              <p className="mt-2 text-muted">{job.experience}</p>
            </section>
          ) : null}
          <section className="mt-6">
            <h2 className="text-lg font-bold text-primary">Skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {job.requiredSkills.map((skill) => (
                <span key={skill} className="rounded-pill bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
                  {skill}
                </span>
              ))}
            </div>
          </section>
          {job.benefits ? (
            <section className="mt-6">
              <h2 className="text-lg font-bold text-primary">Benefits</h2>
              <p className="mt-2 text-muted">{job.benefits}</p>
            </section>
          ) : null}
        </article>

        <aside className="space-y-4">
          {job.match ? (
            <section className="cb-dash-card p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Why this job may suit you</p>
              <ul className="mt-4 space-y-2">
                {job.match.reasons.map((item) => (
                  <li key={item} className="font-semibold text-success">✓ {item}</li>
                ))}
              </ul>
              {job.match.gaps.length ? (
                <>
                  <p className="mt-4 text-sm font-bold text-primary">You may want to improve:</p>
                  <ul className="mt-2 space-y-1 text-warning">
                    {job.match.gaps.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                  <Link
                    href="/resume"
                    className="mt-4 inline-flex h-8 items-center rounded-full bg-[#14b8a6] px-3.5 text-xs font-extrabold text-[#0a2e2c]"
                  >
                    Improve My Resume
                  </Link>
                </>
              ) : null}
            </section>
          ) : null}
          <section className="cb-dash-card p-4 sm:p-5">
            <p className="font-bold text-primary">{job.companyName}</p>
            <p className="mt-1 text-sm text-muted">Verified Employer ✓</p>
            <p className="mt-1 text-sm text-muted">{job.city}</p>
          </section>
        </aside>
      </div>
    </CandidateShell>
  );
}
