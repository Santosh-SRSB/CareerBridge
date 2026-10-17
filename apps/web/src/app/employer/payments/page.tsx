'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { candidateViewCreditsLeft, type EmployerPlanUsage } from '@careerbridge/shared';
import {
  getEmployerDashboard,
  getEmployerPlanUsage,
  listEmployerPayments,
  type EmployerPaymentRow,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EvEmpty, EvPageHead, EvPill, EvSkeleton, EvStat } from '@/components/employer/ui';
import { ErrorState } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE } from '@/lib/client-errors';

function periodLabel(period: string) {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return 'this month';
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function EmployerBillingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState(0);
  const [shortlisted, setShortlisted] = useState(0);
  const [interviews, setInterviews] = useState(0);
  const [usage, setUsage] = useState<EmployerPlanUsage | null>(null);
  const [payments, setPayments] = useState<EmployerPaymentRow[]>([]);
  const [paymentsFailed, setPaymentsFailed] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    setPaymentsFailed(false);
    Promise.all([
      getEmployerDashboard(),
      getEmployerPlanUsage(),
      listEmployerPayments().catch(() => {
        setPaymentsFailed(true);
        return [] as EmployerPaymentRow[];
      }),
    ])
      .then(([dash, planUsage, rows]) => {
        setApplications(dash.applications);
        setShortlisted(dash.shortlisted);
        setInterviews(dash.interviews);
        setUsage(planUsage);
        setPayments(rows);
      })
      .catch(() => setError(LOAD_ERROR_MESSAGE))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <EmployerShellFallback title="Billing">
      <EvPageHead
        eyebrow="Account"
        title="Billing"
        subtitle="Your plan, monthly credits and billing history."
        actions={
          <Link href="/employer" className="ev-btn ev-btn--ghost">
            ← Dashboard
          </Link>
        }
      />

      {error && !loading ? (
        <div className="ev-mt">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : null}
      {loading ? (
        <div className="ev-grid ev-g2 ev-mt" aria-busy="true" aria-label="Loading billing…">
          <EvSkeleton height={180} />
          <EvSkeleton height={180} />
        </div>
      ) : null}

      {!loading && !error && usage ? (
        <>
          <div className="ev-grid ev-g2 ev-mt">
            <section className="ev-card ev-plan" aria-label="Current plan">
              <small className="ev-eyebrow">CURRENT PLAN</small>
              <h2 className="ev-h2">Starter · Free</h2>
              <p className="ev-sub">
                {usage.activeJobLimit > 0 ? `Up to ${usage.activeJobLimit} active jobs` : 'Unlimited active jobs'}
                {' · '}
                {usage.candidateViewCredits > 0
                  ? `${usage.candidateViewCredits} candidate profile views per month`
                  : 'unlimited candidate profile views'}
                . Profiles of candidates who applied to your jobs are always free to view.
              </p>
              <p className="ev-plan-meta">
                Active jobs: {usage.activeJobs}
                {usage.activeJobLimit > 0 ? ` of ${usage.activeJobLimit}` : ''}
              </p>
            </section>
            <CreditsCard usage={usage} />
          </div>

          <section className="ev-mt" aria-label="Usage this month">
            <h2 className="ev-h2">Usage overview · {periodLabel(usage.period)}</h2>
            <div className="ev-grid ev-g4">
              <EvStat label="Candidate views" value={usage.candidateViews} />
              <EvStat label="Applications received" value={applications} />
              <EvStat label="Shortlists" value={shortlisted} />
              <EvStat label="Interviews scheduled" value={interviews} />
            </div>
          </section>

          <section className="ev-card ev-mt" aria-label="Billing history">
            <h2 className="ev-h2">Billing history</h2>
            {paymentsFailed ? (
              <ErrorState message="Something went wrong. We couldn't load your billing history." onRetry={load} />
            ) : payments.length === 0 ? (
              <EvEmpty title="No transactions yet" body="Payments and invoices will appear here." />
            ) : (
              <div className="ev-scroll">
                <table className="ev-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((row) => (
                      <tr key={row.id}>
                        <td>{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                        <td>{row.description || 'Job posting'}</td>
                        <td>
                          <b>
                            {(row.amountPaise / 100).toLocaleString('en-IN', {
                              style: 'currency',
                              currency: row.currency || 'INR',
                            })}
                          </b>
                        </td>
                        <td>
                          <EvPill>{row.status}</EvPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </EmployerShellFallback>
  );
}

function CreditsCard({ usage }: { usage: EmployerPlanUsage }) {
  const unlimited = usage.candidateViewCredits <= 0;
  const left = candidateViewCreditsLeft(usage);
  const pct = unlimited ? 100 : Math.round(((left ?? 0) / usage.candidateViewCredits) * 100);
  return (
    <section className="ev-card ev-plan" aria-label="Credits remaining">
      <small className="ev-eyebrow">CREDITS REMAINING</small>
      <b className="ev-plan-value">{unlimited ? 'Unlimited' : `${left} credits remaining`}</b>
      {unlimited ? null : (
        <div
          className="ev-bar"
          role="progressbar"
          aria-label="Candidate view credits remaining"
          aria-valuemin={0}
          aria-valuemax={usage.candidateViewCredits}
          aria-valuenow={left ?? 0}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="ev-sub">
        {unlimited
          ? 'Candidate profile views are not limited on your plan.'
          : left === 0
            ? 'No credits remaining. You can still view candidates who applied to your jobs.'
            : `${usage.candidateViews} of ${usage.candidateViewCredits} used this month`}
      </p>
      <Link href="/employer/payments/buy" className="ev-btn ev-btn--amber">
        Buy More Credits
      </Link>
    </section>
  );
}
