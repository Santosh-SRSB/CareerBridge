'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { JobDetail, ResumeRecord } from '@careerbridge/shared';
import { applyToJob, getJob, listResumes } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { Button } from '@/components/ui/Button';

export default function ApplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [resumeId, setResumeId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getJob(params.id), listResumes().catch(() => [])])
      .then(([nextJob, nextResumes]) => {
        setJob(nextJob);
        setResumes(nextResumes);
        setResumeId(nextResumes[0]?.id || '');
      })
      .catch(() => setError('This job is no longer available.'));
  }, [params.id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!resumes.length) {
      router.push('/resume');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const application = await applyToJob(params.id, resumeId);
      router.replace(`/applications/${application.id}/confirmation`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your application right now.');
    } finally {
      setLoading(false);
    }
  }

  if (!job) {
    return (
      <CandidateShell>
        <p className="text-muted">Preparing your application...</p>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell>
      <Link href={`/jobs/${job.id}`} className="text-sm font-bold text-teal hover:underline">
        ← Job details
      </Link>
      <h1 className="break-words text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Apply for {job.title}</h1>
      <p className="mt-2 text-muted">{job.companyName} · {job.city}</p>
      <form onSubmit={onSubmit} className="cb-dash-card max-w-3xl space-y-5 p-4 sm:p-5">
        <div>
          <p className="font-bold text-primary">Before you apply</p>
          <ul className="mt-3 space-y-1 text-sm text-primary">
            <li>✓ Career Passport</li>
            <li>✓ Contact information</li>
            <li>{resumes.length ? '✓ Resume available' : '⚠ Create your first resume'}</li>
          </ul>
        </div>
        {resumes.length ? (
          <div>
            <p className="font-bold text-primary">Your resume</p>
            <div className="mt-3 space-y-2">
              {resumes.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${
                    resumeId === item.id ? 'border-primary bg-primary-soft' : 'border-primary/15'
                  }`}
                >
                  <input type="radio" name="resume" checked={resumeId === item.id} onChange={() => setResumeId(item.id)} />
                  <span>
                    <span className="block font-bold text-primary">{item.title}</span>
                    <span className="text-sm text-muted">Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
                  </span>
                </label>
              ))}
            </div>
            {resumeId ? (
              <Link href={`/resume/${resumeId}`} className="mt-3 inline-flex text-sm font-bold text-teal hover:underline">
                Preview resume
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="text-muted">Your Career Passport is ready. Let&apos;s create your first resume.</p>
        )}
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" loading={loading} loadingLabel="Submitting...">
          {resumes.length ? 'Submit Application' : 'Create My Resume'}
        </Button>
      </form>
    </CandidateShell>
  );
}
