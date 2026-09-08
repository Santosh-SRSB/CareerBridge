'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { JobDetail } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { formatJobType, formatSalary } from '@/lib/match';
import { fetchJobDetails, submitApplication } from '@/lib/candidate-marketplace-api';
import { saveJob, unsaveJob } from '@/lib/api';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchJobDetails(params.id)
      .then(setJob)
      .catch(() => setError('This job is no longer available.'));
  }, [params.id]);

  async function toggleSave() {
    if (!job || !getStoredUser()) {
      router.push('/login');
      return;
    }
    setSaving(true);
    try {
      if (job.saved) {
        await unsaveJob(job.id);
        setJob({ ...job, saved: false });
      } else {
        await saveJob(job.id);
        setJob({ ...job, saved: true });
      }
    } catch {
      // keep current state
    } finally {
      setSaving(false);
    }
  }

  async function onApply() {
    if (!job) return;
    if (!getStoredUser()) {
      router.push(`/login?role=candidate&next=${encodeURIComponent(`/jobs/${job.id}`)}`);
      return;
    }
    setApplying(true);
    setError('');
    try {
      const application = await submitApplication(job.id);
      router.replace(`/applications/${application.id}/confirmation`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your application right now.');
      setApplying(false);
    }
  }

  if (error && !job) {
    return (
      <CandidateAppShell activeTab="jobs">
        <p className="text-red-600">{error}</p>
      </CandidateAppShell>
    );
  }

  if (!job) {
    return (
      <CandidateAppShell activeTab="jobs">
        <p className="text-slate-500">Loading job details...</p>
      </CandidateAppShell>
    );
  }

  const matched = job.match?.reasons || [];
  const gaps = job.match?.gaps || [];

  return (
    <CandidateAppShell activeTab="jobs" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <Link href="/jobs" className="text-sm font-bold text-[#0a2e2c] hover:underline">
          ← Find Jobs
        </Link>

        <article className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <button
            type="button"
            disabled={saving}
            onClick={() => void toggleSave()}
            aria-label={job.saved ? 'Unsave job' : 'Save job'}
            title={job.saved ? 'Saved' : 'Save job'}
            className="absolute right-4 top-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-[#0a2e2c]/30 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:right-5 sm:top-5"
          >
            {job.saved ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#0a2e2c]" aria-hidden>
                <path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <div className="min-w-0 pr-12">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{job.title}</h1>
            <p className="mt-1 text-lg font-semibold text-slate-700">{job.companyName}</p>
          </div>
          <p className="mt-3 text-xl font-extrabold text-slate-900">
            {formatSalary(job.salaryMin, job.salaryMax)}/month
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">{formatJobType(job.jobType)}</p>

          <section className="mt-6">
            <h2 className="text-base font-extrabold text-slate-900">About the job</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{job.description}</p>
          </section>

          <section className="mt-6">
            <h2 className="text-base font-extrabold text-slate-900">Requirements</h2>
            <ul className="mt-3 space-y-2">
              {job.requiredSkills.map((skill) => (
                <li key={skill} className="text-sm font-semibold text-emerald-800">
                  ✓ {skill}
                </li>
              ))}
            </ul>
          </section>

          {job.match ? (
            <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">
                Your match: <span className="text-[#0a2e2c]">{job.match.score}%</span>
              </p>
              {matched.length ? (
                <ul className="mt-3 space-y-1.5">
                  {matched.map((reason) => (
                    <li key={reason} className="text-sm font-semibold text-emerald-800">
                      ✓ {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {gaps.length ? (
                <ul className="mt-2 space-y-1.5">
                  {gaps.map((gap) => (
                    <li key={gap} className="text-sm font-semibold text-amber-800">
                      △ {gap}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {error ? <p className="mt-4 text-sm font-semibold text-error">{error}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {job.applied ? (
              <Link
                href="/applications"
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-[#0a2e2c] px-4 py-3 text-sm font-bold text-white sm:w-auto"
              >
                Track Application
              </Link>
            ) : (
              <Button
                className="w-full sm:w-auto"
                loading={applying}
                loadingLabel="Applying…"
                onClick={() => void onApply()}
              >
                Apply Now
              </Button>
            )}
          </div>
        </article>
      </div>
    </CandidateAppShell>
  );
}
