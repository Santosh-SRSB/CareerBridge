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

function splitBenefitsAndLanguages(value: string | null | undefined) {
  const lines = parseList(value);
  const languages: string[] = [];
  const benefits: string[] = [];
  for (const line of lines) {
    const match = line.match(/^languages:\s*(.+)$/i);
    if (match) {
      languages.push(
        ...match[1]
          .split(/[,/|]/)
          .map((item) => item.trim())
          .filter(Boolean),
      );
      continue;
    }
    benefits.push(line);
  }
  return { benefits, languages };
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
  const { benefits, languages } = splitBenefitsAndLanguages(job?.benefits);
  const hasSkillsPanel = skills.length > 0 || languages.length > 0 || benefits.length > 0;

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
          <div className="ep-posted-success__top">
            <article className="ep-posted-success__card">
              <header>
                <h2>Job details</h2>
                <p>Review what candidates will see.</p>
              </header>
              <dl className="ep-posted-success__facts">
                <div>
                  <dt>Title</dt>
                  <dd>{title || '—'}</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{job?.department || '—'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{job?.city || '—'}</dd>
                </div>
                <div>
                  <dt>Job type</dt>
                  <dd>{formatJobType(job?.jobType)}</dd>
                </div>
                <div>
                  <dt>Work mode</dt>
                  <dd>{formatJobType(job?.workMode)}</dd>
                </div>
                <div>
                  <dt>Openings</dt>
                  <dd>{job?.openings ?? '—'}</dd>
                </div>
                <div>
                  <dt>Experience</dt>
                  <dd>{job?.experience || '—'}</dd>
                </div>
                <div>
                  <dt>Education</dt>
                  <dd>{job?.educationMin || '—'}</dd>
                </div>
              </dl>
            </article>

            <article className="ep-posted-success__card">
              <header>
                <h2>Skills &amp; benefits</h2>
                <p>Shown on the job listing.</p>
              </header>
              {hasSkillsPanel ? (
                <div className="ep-posted-success__skill-groups">
                  {skills.length ? (
                    <div className="ep-posted-success__skill-group">
                      <span className="ep-posted-success__skill-label">Skills</span>
                      <div className="ep-posted-success__tags">
                        {skills.map((skill) => (
                          <span key={`skill-${skill}`}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {languages.length ? (
                    <div className="ep-posted-success__skill-group">
                      <span className="ep-posted-success__skill-label">Languages</span>
                      <div className="ep-posted-success__tags">
                        {languages.map((lang) => (
                          <span key={`lang-${lang}`}>{lang}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {benefits.length ? (
                    <div className="ep-posted-success__skill-group">
                      <span className="ep-posted-success__skill-label">Benefits</span>
                      <div className="ep-posted-success__tags">
                        {benefits.map((benefit) => (
                          <span key={`benefit-${benefit}`} className="is-benefit">
                            {benefit}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="ep-posted-success__empty">No skills or benefits listed yet.</p>
              )}
            </article>
          </div>

          <article className="ep-posted-success__card ep-posted-success__card--steps">
            <header>
              <h2>Next steps</h2>
              <p>Here&apos;s how to go from posting to hiring.</p>
            </header>
            <ol className="ep-posted-success__steps">
              <li>
                <span className="ep-posted-success__step-num" aria-hidden>
                  1
                </span>
                <div>
                  <strong>Review matches</strong>
                  <p>Browse candidates by skill fit.</p>
                </div>
              </li>
              <li>
                <span className="ep-posted-success__step-num" aria-hidden>
                  2
                </span>
                <div>
                  <strong>Schedule interviews</strong>
                  <p>Invite strong profiles to talk.</p>
                </div>
              </li>
              <li>
                <span className="ep-posted-success__step-num" aria-hidden>
                  3
                </span>
                <div>
                  <strong>Move to hire</strong>
                  <p>Update application status as you decide.</p>
                </div>
              </li>
            </ol>
          </article>

          <article className="ep-posted-success__card ep-posted-success__card--hire">
            <div>
              <h2>Ready to hire</h2>
              <p>Matched profiles are available for this role.</p>
            </div>
            <Link href={`/employer/jobs/${params.id}`} className="ep-posted-success__solid">
              View job &amp; candidates
            </Link>
          </article>

          <article className="ep-posted-success__card ep-posted-success__card--controls">
            <div className="ep-posted-success__controls">
              <div className="ep-posted-success__controls-left">
                <span className="ep-posted-success__controls-label">Position controls</span>
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
