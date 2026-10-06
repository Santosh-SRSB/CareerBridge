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
import { ErrorState, SkeletonList } from '@/components/ui/StateViews';
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
      <div className="ep-billing ep-page">
        <header className="ep-billing__head">
          <div>
            <p className="ep-billing__eyebrow">Plan &amp; usage</p>
            <h1 className="ep-billing__title">Billing</h1>
            <p className="ep-billing__sub">Your plan, monthly credits and billing history.</p>
          </div>
          <Link href="/employer" className="ep-billing__back">
            ← Dashboard
          </Link>
        </header>

        {error && !loading ? <ErrorState message={error} onRetry={load} /> : null}
        {loading ? <SkeletonList rows={3} label="Loading billing…" /> : null}

        {!loading && !error && usage ? (
          <>
            <section className="ep-billing__plan" aria-label="Current plan">
              <div>
                <p className="ep-billing__plan-label">Current plan</p>
                <h2>Starter · Free</h2>
                <p>
                  {usage.activeJobLimit > 0
                    ? `Up to ${usage.activeJobLimit} active jobs`
                    : 'Unlimited active jobs'}
                  {' · '}
                  {usage.candidateViewCredits > 0
                    ? `${usage.candidateViewCredits} candidate profile views per month`
                    : 'unlimited candidate profile views'}
                  . Profiles of candidates who applied to your jobs are always free to view.
                </p>
                <p className="mt-2 text-sm font-semibold">
                  Active jobs: {usage.activeJobs}
                  {usage.activeJobLimit > 0 ? ` of ${usage.activeJobLimit}` : ''}
                </p>
              </div>
              <CreditsCard usage={usage} />
            </section>

            <section className="ep-billing__usage" aria-label="Usage this month">
              <h3>Usage overview · {periodLabel(usage.period)}</h3>
              <ul>
                <li>
                  <span>Candidate Views</span>
                  <strong>{usage.candidateViews}</strong>
                </li>
                <li>
                  <span>Applications received</span>
                  <strong>{applications}</strong>
                </li>
                <li>
                  <span>Shortlists</span>
                  <strong>{shortlisted}</strong>
                </li>
                <li>
                  <span>Interviews scheduled</span>
                  <strong>{interviews}</strong>
                </li>
              </ul>
            </section>

            <section className="ep-billing__history" aria-label="Billing history">
              <h3>Billing history</h3>
              {paymentsFailed ? (
                <ErrorState
                  message="Something went wrong. We couldn't load your billing history."
                  onRetry={load}
                />
              ) : payments.length === 0 ? (
                <p className="ep-billing__muted">No transactions yet.</p>
              ) : (
                <div className="ep-saas-table-wrap">
                  <table className="ep-saas-table">
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
                            {(row.amountPaise / 100).toLocaleString('en-IN', {
                              style: 'currency',
                              currency: row.currency || 'INR',
                            })}
                          </td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </EmployerShellFallback>
  );
}

function CreditsCard({ usage }: { usage: EmployerPlanUsage }) {
  const unlimited = usage.candidateViewCredits <= 0;
  const left = candidateViewCreditsLeft(usage);
  const pct = unlimited ? 100 : Math.round(((left ?? 0) / usage.candidateViewCredits) * 100);
  return (
    <div className="ep-billing__credits" aria-label="Credits remaining">
      <p className="ep-billing__plan-label">Credits remaining</p>
      <strong>{unlimited ? 'Unlimited' : `${left} credits remaining`}</strong>
      {unlimited ? null : (
        <div
          className="ep-billing__bar"
          role="progressbar"
          aria-label="Candidate view credits remaining"
          aria-valuemin={0}
          aria-valuemax={usage.candidateViewCredits}
          aria-valuenow={left ?? 0}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      <em>
        {unlimited
          ? 'Candidate profile views are not limited on your plan.'
          : left === 0
            ? 'No credits remaining. You can still view candidates who applied to your jobs.'
            : `${usage.candidateViews} of ${usage.candidateViewCredits} used this month`}
      </em>
      <Link href="/employer/payments/buy" className="ep-billing__back mt-3 inline-flex min-h-12 items-center">
        Buy More Credits
      </Link>
    </div>
  );
}
