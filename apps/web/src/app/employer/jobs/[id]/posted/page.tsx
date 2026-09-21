'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { getEmployerJob } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { JobStatusActions } from '@/components/employer/JobStatusActions';

type JobDetail = {
  title?: string;
  status?: string;
  city?: string | null;
  department?: string | null;
  jobType?: string | null;
  experience?: string | null;
  educationMin?: string | null;
  workMode?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  description?: string | null;
  requiredSkills?: string | string[] | null;
  benefits?: string | null;
  openings?: number | null;
  publishedAt?: string | null;
};

function parseList(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch {
    /* plain text */
  }
  return value
    .split(/[\n,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatJobType(value?: string | null) {
  if (!value) return '—';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function JobPostedBody() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('PUBLISHED');

  useEffect(() => {
    const fromQuery = searchParams.get('title')?.trim() || '';
    if (fromQuery) setTitle(fromQuery);
    void getEmployerJob(params.id)
      .then((row) => {
        const next = row as JobDetail;
        setJob(next);
        if (typeof next.title === 'string' && next.title.trim()) setTitle(next.title.trim());
        if (typeof next.status === 'string') setStatus(next.status);
      })
      .catch(() => undefined);
  }, [params.id, searchParams]);

  const skills = parseList(job?.requiredSkills);
  const benefits = parseList(job?.benefits);

  return (
    <EmployerShellFallback title="Job posted">
      <div className="ep-posted-success">
        <section className="ep-posted-success__hero">
          <div className="ep-posted-success__check" aria-hidden>
            ✓
          </div>
          <h1>Job posted successfully</h1>
          <p>
            <strong>{title || 'Your role'}</strong> is live on CareerBridge.
          </p>
          <div className="ep-posted-success__cta">
            <Link href="/employer/jobs/new" className="ep-posted-success__btn">
              Post another job
            </Link>
            <Link href="/employer/jobs" className="ep-posted-success__link">
              Go to My Jobs →
            </Link>
          </div>
        </section>

        <div className="ep-posted-success__body">
          <div className="ep-posted-success__grid">
            <article className="ep-posted-success__card">
              <header>
                <h2>Compact Job Details</h2>
                <p>Review what candidates will see</p>
              </header>
              <dl className="ep-posted-success__facts">
                <div>
                  <dt>Title</dt>
                  <dd>{title || '—'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{job?.city || '—'}</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{job?.department || '—'}</dd>
                </div>
                <div>
                  <dt>Job type</dt>
                  <dd>{formatJobType(job?.jobType)}</dd>
                </div>
                <div>
                  <dt>Experience</dt>
                  <dd>{job?.experience || '—'}</dd>
                </div>
                <div>
                  <dt>Openings</dt>
                  <dd>{job?.openings ?? '—'}</dd>
                </div>
                {job?.educationMin ? (
                  <div>
                    <dt>Education</dt>
                    <dd>{job.educationMin}</dd>
                  </div>
                ) : null}
                {job?.workMode ? (
                  <div>
                    <dt>Work mode</dt>
                    <dd>{formatJobType(job.workMode)}</dd>
                  </div>
                ) : null}
              </dl>
            </article>

            <article className="ep-posted-success__card">
              <header>
                <h2>Skills &amp; Benefits</h2>
              </header>
              {skills.length || benefits.length ? (
                <div className="ep-posted-success__tags">
                  {skills.map((skill) => (
                    <span key={`skill-${skill}`}>{skill}</span>
                  ))}
                  {benefits.map((benefit) => (
                    <span key={`benefit-${benefit}`} className="is-benefit">
                      {benefit}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="ep-posted-success__empty">No skills or benefits listed yet.</p>
              )}
            </article>

            <article className="ep-posted-success__card ep-posted-success__card--hire">
              <header>
                <h2>Ready to Hire</h2>
                <p>Matched profiles are available for this role.</p>
              </header>
              <Link href={`/employer/jobs/${params.id}`} className="ep-posted-success__solid">
                View job &amp; candidates
              </Link>
            </article>

            <article className="ep-posted-success__card">
              <header>
                <h2>Next Steps</h2>
              </header>
              <ol className="ep-posted-success__steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Review matches</strong>
                    <p>Browse candidates by skill fit.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Schedule interviews</strong>
                    <p>Invite strong profiles to talk.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Move to hire</strong>
                    <p>Update application status as you decide.</p>
                  </div>
                </li>
              </ol>
            </article>
          </div>

          <article className="ep-posted-success__card ep-posted-success__card--controls">
            <header>
              <h2>Position Controls</h2>
            </header>
            <div className="ep-posted-success__controls">
              <div className="ep-posted-success__status-btns">
                <JobStatusActions
                  jobId={params.id}
                  status={status}
                  compact
                  onUpdated={async () => {
                    const next = await getEmployerJob(params.id);
                    setJob(next as JobDetail);
                    if (typeof next.status === 'string') setStatus(next.status);
                  }}
                />
              </div>
              <div className="ep-posted-success__navlinks">
                <Link href={`/employer/jobs/${params.id}`}>Open job details</Link>
                <Link href="/employer/jobs/new">Post another job →</Link>
                <Link href="/employer/jobs">Go to My Jobs →</Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </EmployerShellFallback>
  );
}

export default function JobPostedPage() {
  return (
    <Suspense>
      <JobPostedBody />
    </Suspense>
  );
}
