'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  candidateViewCreditsLeft,
  getEmployerSubscriptionPlan,
  type EmployerPlanUsage,
} from '@careerbridge/shared';
import {
  getEmployerDashboard,
  getEmployerPlanUsage,
  getEmployerSubscription,
  listEmployerPayments,
  type EmployerPaymentRow,
  type EmployerSubscriptionStatus,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EvEmpty, EvPageHead, EvPill, EvSkeleton, EvStat } from '@/components/employer/ui';
import { ErrorState } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE } from '@/lib/client-errors';

function periodLabel(period: string) {
  if (period.startsWith('sub:')) return 'current subscription period';
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return 'this period';
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
  const [subscription, setSubscription] = useState<EmployerSubscriptionStatus | null>(null);
  const [payments, setPayments] = useState<EmployerPaymentRow[]>([]);
  const [paymentsFailed, setPaymentsFailed] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    setPaymentsFailed(false);
    Promise.all([
      getEmployerDashboard(),
      getEmployerPlanUsage(),
      getEmployerSubscription().catch(() => null),
      listEmployerPayments().catch(() => {
        setPaymentsFailed(true);
        return [] as EmployerPaymentRow[];
      }),
    ])
      .then(([dash, planUsage, sub, rows]) => {
        setApplications(dash.applications);
        setShortlisted(dash.shortlisted);
        setInterviews(dash.interviews);
        setUsage(planUsage);
        setSubscription(sub);
        setPayments(rows);
      })
      .catch(() => setError(LOAD_ERROR_MESSAGE))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const catalog = getEmployerSubscriptionPlan(subscription?.planId || usage?.planId);
  const planTitle = subscription?.active
    ? `${catalog?.name || subscription.planId} · Active`
    : 'No active paid plan';
  const endsLabel = subscription?.endsAt
    ? new Date(subscription.endsAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;
  const endsAtMs = subscription?.endsAt ? new Date(subscription.endsAt).getTime() : null;
  const daysLeft =
    subscription?.active && endsAtMs != null
      ? Math.ceil((endsAtMs - Date.now()) / (24 * 60 * 60 * 1000))
      : null;
  const showRenewBanner =
    !loading &&
    !error &&
    (!subscription?.active || (daysLeft != null && daysLeft <= 7));

  return (
    <EmployerShellFallback title="Billing">
      <EvPageHead
        eyebrow="Account"
        title="Billing"
        subtitle="Your subscription, usage and payment history."
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
      {showRenewBanner ? (
        <div className="ev-card ev-mt" role="status" style={{ borderColor: '#c9a227' }}>
          <p className="ev-sub" style={{ margin: 0 }}>
            {!subscription?.active
              ? 'No active subscription — renew or choose a plan to post jobs and view candidates.'
              : daysLeft != null && daysLeft <= 0
                ? 'Your subscription ends today. Renew to keep posting jobs and viewing candidates.'
                : `Your subscription ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to avoid interruption.`}
          </p>
          <Link href="/employer/payments/buy" className="ev-btn ev-btn--amber" style={{ marginTop: 10 }}>
            Renew or change plan
          </Link>
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
              <h2 className="ev-h2">{planTitle}</h2>
              <p className="ev-sub">
                {subscription?.active
                  ? endsLabel
                    ? `Valid until ${endsLabel}. Manual renewal.`
                    : 'Active subscription. Manual renewal.'
                  : 'Choose a plan to unlock Post a job, recruiter seats and candidate database views.'}
              </p>
              <p className="ev-plan-meta">
                Active jobs: {usage.activeJobs}
                {usage.activeJobLimit > 0 ? ` of ${usage.activeJobLimit}` : subscription?.active ? '' : ' (subscription required)'}
                {usage.loginSeats != null
                  ? ` · Seats: ${usage.loginSeatsUsed ?? 0} of ${usage.loginSeats}`
                  : usage.loginSeatsUsed != null
                    ? ` · Seats: ${usage.loginSeatsUsed}`
                    : ''}
              </p>
              <Link
                href={
                  subscription?.active
                    ? '/employer/payments/buy'
                    : '/employer/payments/buy?intent=post-job'
                }
                className="ev-btn ev-btn--amber"
                style={{ marginTop: 12 }}
              >
                {subscription?.active ? 'Renew or change plan' : 'View subscription plans'}
              </Link>
            </section>
            <CreditsCard usage={usage} />
          </div>

          <section className="ev-mt" aria-label="Usage this period">
            <h2 className="ev-h2">Usage overview · {periodLabel(usage.period)}</h2>
            <div className="ev-grid ev-g4">
              <EvStat label="Candidate DB views" value={usage.candidateViews} />
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
                      <th>Plan</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((row) => {
                      const planName = row.planId
                        ? getEmployerSubscriptionPlan(row.planId)?.name || row.planId
                        : '—';
                      return (
                      <tr key={row.id}>
                        <td>{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                        <td>{row.description || 'Payment'}</td>
                        <td>{planName}</td>
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
                      );
                    })}
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
  const unlimited = usage.candidateViewCredits <= 0 && usage.subscriptionActive;
  const left = candidateViewCreditsLeft(usage);
  const pct =
    !usage.subscriptionActive || unlimited
      ? 100
      : Math.round(((left ?? 0) / Math.max(1, usage.candidateViewCredits)) * 100);
  return (
    <section className="ev-card ev-plan" aria-label="Credits remaining">
      <small className="ev-eyebrow">DATABASE VIEWS</small>
      <b className="ev-plan-value">
        {!usage.subscriptionActive
          ? 'Subscription required'
          : unlimited
            ? 'Unlimited'
            : `${left} views remaining`}
      </b>
      {usage.subscriptionActive && !unlimited ? (
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
      ) : null}
      <p className="ev-sub">
        {!usage.subscriptionActive
          ? 'Purchase a plan to open candidate profiles from search. Own-job applicants stay free.'
          : unlimited
            ? 'Candidate profile views are not limited on your plan.'
            : left === 0
              ? 'No views remaining. You can still open candidates who applied to your jobs.'
              : `${usage.candidateViews} of ${usage.candidateViewCredits} used this period`}
      </p>
      <Link href="/employer/payments/buy" className="ev-btn ev-btn--amber">
        {usage.subscriptionActive ? 'Upgrade plan' : 'Choose a plan'}
      </Link>
    </section>
  );
}
