'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { getEmployerJob } from '@/lib/api';
import { EmployerShellFallback, EmployerPageHeader } from '@/components/EmployerPortal';
import { JobStatusActions } from '@/components/employer/JobStatusActions';
import { Button } from '@/components/ui/Button';

function JobPostedBody() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('PUBLISHED');

  useEffect(() => {
    const fromQuery = searchParams.get('title')?.trim() || '';
    if (fromQuery) setTitle(fromQuery);
    void getEmployerJob(params.id)
      .then((job) => {
        if (typeof job.title === 'string' && job.title.trim()) setTitle(job.title.trim());
        if (typeof job.status === 'string') setStatus(job.status);
      })
      .catch(() => undefined);
  }, [params.id, searchParams]);

  return (
    <EmployerShellFallback title="Job posted">
      <div className="ep-desk">
        <EmployerPageHeader
          title="Job posted"
          subtitle={`Your ${title || 'job'} opening is live. Matched candidate profiles are ready to review.`}
        />

        <div className="ep-posted">
          <article className="ep-card ep-posted__hero">
            <div className="ep-posted__badge" aria-hidden>
              ✓
            </div>
            <div>
              <p className="ep-posted__kicker">Published</p>
              <h2>Job posted successfully</h2>
              <p>
                <strong>{title || 'Your role'}</strong> is live on CareerBridge. Hiring is free for
                now — review matched candidates anytime.
              </p>
            </div>
            <div className="ep-posted__chips">
              <span>{status.replaceAll('_', ' ')}</span>
              <span>Free access</span>
            </div>
          </article>

          <div className="ep-posted__grid">
            <article className="ep-card ep-posted__pay is-done">
              <div className="ep-card__head">
                <div>
                  <h2>Ready to hire</h2>
                  <p>Matched profiles are available for this role.</p>
                </div>
              </div>
              <Link href={`/employer/jobs/${params.id}`} className="ep-btn-gold">
                View matched candidates
              </Link>
            </article>

            <article className="ep-card">
              <div className="ep-card__head">
                <h2>Next steps</h2>
              </div>
              <ul className="ep-posted__steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Review matches</strong>
                    <p>Shortlist candidates by skill fit.</p>
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
              </ul>
              <div className="ep-posted__actions">
                <Link href={`/employer/jobs/${params.id}`}>
                  <Button type="button" size="sm" block={false} className="ep-btn-save">
                    Open pipeline
                  </Button>
                </Link>
                <Link href="/employer/jobs/new" className="ep-link">
                  Post another job →
                </Link>
                <Link href="/employer/jobs" className="ep-link">
                  Go to My Jobs →
                </Link>
              </div>
            </article>
          </div>

          <article className="ep-card">
            <div className="ep-card__head">
              <h2>Position controls</h2>
              <p>Pause or close this role anytime</p>
            </div>
            <JobStatusActions
              jobId={params.id}
              status={status}
              onUpdated={async () => {
                const job = await getEmployerJob(params.id);
                if (typeof job.status === 'string') setStatus(job.status);
              }}
            />
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
