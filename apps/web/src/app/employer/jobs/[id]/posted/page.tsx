'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { getEmployerJob } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import { EvJobStatus, EvPageHead } from '@/components/employer/ui';

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

const NEXT_STEPS = [
  { title: 'Review matches', body: 'Browse candidates by skill fit.' },
  { title: 'Schedule interviews', body: 'Invite strong profiles to talk.' },
  { title: 'Move to hire', body: 'Update application status as you decide.' },
] as const;

function JobPostedBody() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('');
  const pendingReview = status === 'PENDING_REVIEW';

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

  const facts: Array<[string, string | number]> = [
    ['Title', title || '—'],
    ['Department', job?.department || '—'],
    ['Location', job?.city || '—'],
    ['Job type', formatJobType(job?.jobType)],
    ['Work mode', formatJobType(job?.workMode)],
    ['Openings', job?.openings ?? '—'],
    ['Experience', job?.experience || '—'],
    ['Education', job?.educationMin || '—'],
  ];

  return (
    <EmployerShellFallback title="Job posted">
      <EvPageHead
        eyebrow="✓ Job posted"
        title={pendingReview ? 'Job submitted for review' : 'Job posted successfully'}
        subtitle={
          <>
            <b>{title || 'Your role'}</b>
            {pendingReview
              ? ' is waiting for CareerBridge approval. Candidates will see it once it is approved.'
              : status === 'PUBLISHED'
                ? ' is live on CareerBridge.'
                : ' has been saved.'}
          </>
        }
        actions={
          <>
            <Link href="/employer/jobs/new" className="ev-btn">
              Post another job
            </Link>
            <Link href="/employer/jobs" className="ev-btn ev-btn--ghost">
              Go to My Jobs →
            </Link>
          </>
        }
      />

      <div className="ev-grid ev-g2">
        <article className="ev-card">
          <div className="ev-card-head">
            <div>
              <h2>Job details</h2>
              <p className="ev-sub">Review what candidates will see.</p>
            </div>
            {status ? <EvJobStatus status={status} /> : null}
          </div>
          {facts.map(([label, value]) => (
            <div key={label} className="ev-r2">
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
        </article>

        <article className="ev-card">
          <h2>Skills &amp; benefits</h2>
          <p className="ev-sub" style={{ marginTop: -8, marginBottom: 12 }}>
            Shown on the job listing.
          </p>
          {hasSkillsPanel ? (
            <>
              {skills.length ? (
                <>
                  <div className="ev-sub2">SKILLS</div>
                  <div className="ev-chips2">
                    {skills.map((skill) => (
                      <span key={`skill-${skill}`} className="ev-sk" style={{ paddingRight: 14 }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {languages.length ? (
                <>
                  <div className="ev-sub2">LANGUAGES</div>
                  <div className="ev-chips2">
                    {languages.map((lang) => (
                      <span key={`lang-${lang}`} className="ev-chip">
                        {lang}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {benefits.length ? (
                <>
                  <div className="ev-sub2">BENEFITS</div>
                  <div className="ev-chips2">
                    {benefits.map((benefit) => (
                      <span key={`benefit-${benefit}`} className="ev-pill ev-pill--green">
                        {benefit}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <p className="ev-sub">No skills or benefits listed yet.</p>
          )}
        </article>
      </div>

      <article className="ev-card ev-mt">
        <h2>Next steps</h2>
        <p className="ev-sub" style={{ marginTop: -8, marginBottom: 12 }}>
          Here&apos;s how to go from posting to hiring.
        </p>
        <div className="ev-grid ev-g4">
          {NEXT_STEPS.map((step, index) => (
            <div key={step.title} className="ev-row" style={{ margin: 0, justifyContent: 'flex-start' }}>
              <span className="ev-num">{index + 1}</span>
              <span>
                <b style={{ color: 'var(--ev-ink)' }}>{step.title}</b>
                <br />
                <span className="ev-sub">{step.body}</span>
              </span>
            </div>
          ))}
        </div>
      </article>

      <div className="ev-grid ev-g2 ev-mt">
        <article className="ev-card">
          <h2>{pendingReview ? 'Awaiting approval' : 'Ready to hire'}</h2>
          <p className="ev-sub" style={{ marginBottom: 14 }}>
            {pendingReview
              ? 'Candidate matching starts as soon as the job is approved.'
              : 'Matched profiles are available for this role.'}
          </p>
          <Link href={`/employer/jobs/${params.id}`} className="ev-btn">
            View job &amp; candidates
          </Link>
        </article>

        <article className="ev-card">
          <h2>Position controls</h2>
          <div className="ev-jx" style={{ justifyContent: 'flex-start', marginBottom: 14 }}>
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
          <div className="ev-chips2">
            <Link href={`/employer/jobs/${params.id}`} className="ev-lnk">
              Open job details
            </Link>
            <Link href="/employer/jobs/new" className="ev-lnk">
              Post another job →
            </Link>
            <Link href="/employer/jobs" className="ev-lnk">
              Go to My Jobs →
            </Link>
          </div>
        </article>
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
