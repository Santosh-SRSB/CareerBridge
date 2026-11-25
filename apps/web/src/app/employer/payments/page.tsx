'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
  listMyEnterpriseOffers,
  type EmployerPaymentRow,
  type EmployerSubscriptionStatus,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { ErrorState } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE, userFacingError } from '@/lib/client-errors';
import { checkoutEnterpriseOffer } from '@/lib/employer-plan-checkout';
import { toast } from '@/components/ui/Toast';
import './billing-redesign.css';

type HistoryFilter = 'all' | 'paid' | 'pending';

function periodLabel(period: string, endsAt?: string | null) {
  if (period.startsWith('sub:')) {
    if (endsAt) {
      const end = new Date(endsAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `current subscription · until ${end}`;
    }
    return 'current subscription period';
  }
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return 'this period';
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function isPaidStatus(status: string) {
  return String(status || '').toUpperCase() === 'PAID';
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
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
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [enterpriseOffers, setEnterpriseOffers] = useState<
    Array<{
      id: string;
      amountPaise: number;
      durationDays: number;
      activeJobLimit: number;
      loginSeats: number;
      candidateViewCredits: number;
      expiresAt: string | null;
    }>
  >([]);
  const [offerPayingId, setOfferPayingId] = useState('');

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
      listMyEnterpriseOffers().catch(() => ({ offers: [] })),
    ])
      .then(([dash, planUsage, sub, rows, offers]) => {
        setApplications(dash.applications);
        setShortlisted(dash.shortlisted);
        setInterviews(dash.interviews);
        setUsage(planUsage);
        setSubscription(sub);
        setPayments(rows);
        setEnterpriseOffers(offers.offers || []);
      })
      .catch(() => setError(LOAD_ERROR_MESSAGE))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const catalog = getEmployerSubscriptionPlan(subscription?.planId || usage?.planId);
  const planName = catalog?.name || (subscription?.planId ? String(subscription.planId) : 'No plan');
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

  const jobsPct =
    usage && usage.activeJobLimit > 0
      ? Math.min(100, Math.round((usage.activeJobs / usage.activeJobLimit) * 100))
      : usage?.subscriptionActive
        ? 100
        : 0;
  const seatsPct =
    usage && usage.loginSeats != null && usage.loginSeats > 0
      ? Math.min(100, Math.round(((usage.loginSeatsUsed ?? 0) / usage.loginSeats) * 100))
      : 0;

  const viewsLeft = usage ? candidateViewCreditsLeft(usage) : null;
  const unlimitedViews = Boolean(usage && usage.candidateViewCredits <= 0 && usage.subscriptionActive);
  const viewsPct = !usage
    ? 0
    : !usage.subscriptionActive
      ? 0
      : unlimitedViews
        ? 100
        : Math.round(((viewsLeft ?? 0) / Math.max(1, usage.candidateViewCredits)) * 100);
  const ringOffset = 314 * (1 - viewsPct / 100);

  const paidCount = useMemo(() => payments.filter((p) => isPaidStatus(p.status)).length, [payments]);
  const pendingCount = payments.length - paidCount;
  const filteredPayments = useMemo(() => {
    if (historyFilter === 'paid') return payments.filter((p) => isPaidStatus(p.status));
    if (historyFilter === 'pending') return payments.filter((p) => !isPaidStatus(p.status));
    return payments;
  }, [payments, historyFilter]);

  return (
    <EmployerShellFallback title="Billing">
      <div className="cb-bill">
        <section className="cb-bill__hero cb-bill__in">
          <div>
            <span className="cb-bill__eyb">Account</span>
            <h1>Billing</h1>
            <p>Your subscription, usage and payment history.</p>
          </div>
          <Link href="/employer" className="cb-bill__btn cb-bill__btn--glass">
            ← Dashboard
          </Link>
        </section>

        {error && !loading ? (
          <div className="cb-bill__in" style={{ '--d': '0.05s' } as CSSProperties}>
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : null}

        {showRenewBanner ? (
          <div className="cb-bill__banner cb-bill__in" role="status" style={{ '--d': '0.08s' } as CSSProperties}>
            <p>
              {!subscription?.active
                ? 'No active subscription — renew or choose a plan to post jobs and view candidates.'
                : daysLeft != null && daysLeft <= 0
                  ? 'Your subscription ends today. Renew to keep posting jobs and viewing candidates.'
                  : `Your subscription ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to avoid interruption.`}
            </p>
            <Link href="/employer/payments/buy" className="cb-bill__btn cb-bill__btn--gold">
              Renew or change plan
            </Link>
          </div>
        ) : null}

        {loading ? (
          <div className="cb-bill__two cb-bill__in" style={{ '--d': '0.1s' } as CSSProperties} aria-busy="true">
            <div className="cb-bill__card" style={{ minHeight: 220 }} />
            <div className="cb-bill__card" style={{ minHeight: 220 }} />
          </div>
        ) : null}

        {!loading && !error && usage ? (
          <>
            <section className="cb-bill__two cb-bill__in" style={{ '--d': '0.1s' } as CSSProperties}>
              <div className="cb-bill__card">
                <div className="cb-bill__lab">
                  <span className="cb-bill__ico">
                    <Icon path="M3 17l6-6 4 4 8-8M15 7h6v6" />
                  </span>
                  Current plan
                </div>
                <div className="cb-bill__plan">
                  <h2>{subscription?.active ? planName : 'No plan'}</h2>
                  {subscription?.active ? (
                    <span className="cb-bill__pill cb-bill__pill--act">
                      <i />
                      Active
                    </span>
                  ) : (
                    <span className="cb-bill__pill cb-bill__pill--warn">
                      <i />
                      Inactive
                    </span>
                  )}
                  {daysLeft != null ? (
                    <span className="cb-bill__pill cb-bill__pill--days">
                      {daysLeft > 0 ? `${daysLeft} days left` : 'Renewal due'}
                    </span>
                  ) : null}
                </div>
                <p className="cb-bill__sub">
                  {subscription?.active
                    ? endsLabel
                      ? `Valid until ${endsLabel}. Manual renewal.`
                      : 'Active subscription. Manual renewal.'
                    : 'Choose a plan to unlock Post a job, recruiter seats and candidate database views.'}
                </p>
                <div className="cb-bill__meters">
                  <div className="cb-bill__m">
                    <div>
                      <span>Active jobs</span>
                      <b>
                        {usage.activeJobs}
                        {usage.activeJobLimit > 0 ? ` of ${usage.activeJobLimit}` : usage.subscriptionActive ? '' : ' · locked'}
                      </b>
                    </div>
                    <div className="cb-bill__track">
                      <div className="cb-bill__fill" style={{ width: `${jobsPct}%` }} />
                    </div>
                  </div>
                  <div className="cb-bill__m">
                    <div>
                      <span>Seats</span>
                      <b>
                        {usage.loginSeats != null
                          ? `${usage.loginSeatsUsed ?? 0} of ${usage.loginSeats}`
                          : usage.loginSeatsUsed != null
                            ? String(usage.loginSeatsUsed)
                            : '—'}
                      </b>
                    </div>
                    <div className="cb-bill__track">
                      <div className="cb-bill__fill" style={{ width: `${seatsPct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="cb-bill__row">
                  {subscription?.active ? (
                    <Link href="/employer/jobs/new" className="cb-bill__btn cb-bill__btn--pri">
                      Post a job
                    </Link>
                  ) : null}
                  <Link
                    href={
                      subscription?.active
                        ? '/employer/payments/buy'
                        : '/employer/payments/buy?intent=post-job'
                    }
                    className={
                      subscription?.active ? 'cb-bill__btn cb-bill__btn--ghost' : 'cb-bill__btn cb-bill__btn--gold'
                    }
                  >
                    {subscription?.active ? 'Renew or change plan' : 'View subscription plans'}
                  </Link>
                </div>
              </div>

              <div className="cb-bill__card cb-bill__views">
                <div className="cb-bill__lab">
                  <span className="cb-bill__ico">
                    <Icon path="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
                  </span>
                  Database views
                </div>
                <div className="cb-bill__ringw">
                  <div className="cb-bill__ring">
                    <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden>
                      <defs>
                        <linearGradient id="cbBillGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#1A1FC4" />
                          <stop offset="1" stopColor="#4F63FF" />
                        </linearGradient>
                      </defs>
                      <circle className="bgc" cx="64" cy="64" r="50" />
                      <circle className="fg" cx="64" cy="64" r="50" style={{ strokeDashoffset: ringOffset }} />
                    </svg>
                    <div>
                      <b>{!usage.subscriptionActive ? '—' : unlimitedViews ? '∞' : (viewsLeft ?? 0)}</b>
                      <span>views left</span>
                    </div>
                  </div>
                  <div className="cb-bill__vt">
                    <b>
                      {!usage.subscriptionActive
                        ? 'Subscription required'
                        : unlimitedViews
                          ? 'Unlimited views'
                          : `${viewsLeft ?? 0} views remaining`}
                    </b>
                    <span>
                      {!usage.subscriptionActive
                        ? 'Purchase a plan to open candidate profiles from search.'
                        : unlimitedViews
                          ? 'Candidate profile views are not limited on your plan.'
                          : `${usage.candidateViews} of ${usage.candidateViewCredits} used this period`}
                    </span>
                  </div>
                </div>
                <Link href="/employer/payments/buy" className="cb-bill__btn cb-bill__btn--gold">
                  {usage.subscriptionActive ? 'Upgrade plan' : 'Choose a plan'}
                </Link>
              </div>
            </section>

            {enterpriseOffers.length > 0 ? (
              <section className="cb-bill__card cb-bill__in" style={{ '--d': '0.15s' } as CSSProperties} aria-label="Enterprise offers">
                <div className="cb-bill__hh">
                  <h3>Your Enterprise offer</h3>
                </div>
                <p className="cb-bill__sub">Configured by SRSB — pay online with the exact approved amount.</p>
                {enterpriseOffers.map((offer) => (
                  <div key={offer.id} className="cb-bill__offer">
                    <div>
                      <strong>₹{Math.round(offer.amountPaise / 100).toLocaleString('en-IN')}</strong>
                      <span className="cb-bill__sub" style={{ display: 'inline', margin: 0 }}>
                        {' '}
                        · {offer.durationDays} days · {offer.activeJobLimit} jobs · {offer.loginSeats} seats ·{' '}
                        {offer.candidateViewCredits} views
                      </span>
                    </div>
                    <button
                      type="button"
                      className="cb-bill__btn cb-bill__btn--gold"
                      disabled={Boolean(offerPayingId)}
                      onClick={async () => {
                        setOfferPayingId(offer.id);
                        try {
                          await checkoutEnterpriseOffer(offer.id);
                          toast.success('Enterprise plan payment successful.');
                          load();
                        } catch (err) {
                          const msg = userFacingError(err, 'complete payment');
                          if (!/cancel/i.test(msg)) toast.error(msg);
                        } finally {
                          setOfferPayingId('');
                        }
                      }}
                    >
                      {offerPayingId === offer.id ? 'Opening checkout…' : 'Pay offer'}
                    </button>
                  </div>
                ))}
              </section>
            ) : null}

            <h3 className="cb-bill__in" style={{ '--d': '0.2s' } as CSSProperties}>
              Usage overview · {periodLabel(usage.period, subscription?.endsAt || usage.endsAt)}
            </h3>
            <section className="cb-bill__stats cb-bill__in" style={{ '--d': '0.25s' } as CSSProperties} aria-label="Usage this period">
              {[
                { label: 'Candidate DB views', value: usage.candidateViews },
                { label: 'Applications received', value: applications },
                { label: 'Shortlists', value: shortlisted },
                { label: 'Interviews scheduled', value: interviews },
              ].map((stat, i) => (
                <div key={stat.label} className="cb-bill__stat" style={{ '--i': i } as CSSProperties}>
                  <span className="cb-bill__ico">
                    <Icon path="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                  </span>
                  <div>
                    <span>{stat.label}</span>
                    <b>{stat.value.toLocaleString('en-IN')}</b>
                  </div>
                </div>
              ))}
            </section>

            <section className="cb-bill__card cb-bill__in" style={{ '--d': '0.3s' } as CSSProperties} aria-label="Billing history">
              <div className="cb-bill__hh">
                <h3>Billing history</h3>
                <div className="cb-bill__tabs" role="tablist" aria-label="Filter payments">
                  {(
                    [
                      ['all', 'All', payments.length],
                      ['paid', 'Paid', paidCount],
                      ['pending', 'Pending', pendingCount],
                    ] as const
                  ).map(([id, label, count]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={historyFilter === id}
                      className={historyFilter === id ? 'is-on' : undefined}
                      onClick={() => setHistoryFilter(id)}
                    >
                      {label}
                      <em>{count}</em>
                    </button>
                  ))}
                </div>
              </div>

              {paymentsFailed ? (
                <ErrorState
                  message="Something went wrong. We couldn't load your billing history."
                  onRetry={load}
                />
              ) : filteredPayments.length === 0 ? (
                <div className="cb-bill__empty">
                  {payments.length === 0
                    ? 'No transactions yet. Payments and invoices will appear here.'
                    : 'No payments in this view.'}
                </div>
              ) : (
                <div className="cb-bill__tw">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Plan</th>
                        <th className="r">Taxable</th>
                        <th className="r">GST</th>
                        <th className="r">Total</th>
                        <th>Invoice</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((row) => {
                        const planRowName = row.planId
                          ? getEmployerSubscriptionPlan(row.planId)?.name || row.planId
                          : null;
                        const inr = (paise: number) =>
                          (paise / 100).toLocaleString('en-IN', {
                            style: 'currency',
                            currency: row.currency || 'INR',
                          });
                        const paid = isPaidStatus(row.status);
                        const gstNote =
                          row.taxablePaise != null && row.gstPaise != null
                            ? `excl. GST ${inr(row.taxablePaise)} + GST ${inr(row.gstPaise)}`
                            : null;
                        return (
                          <tr key={row.id}>
                            <td>{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                            <td className="cb-bill__d">
                              <b>{row.description || 'Payment'}</b>
                              {gstNote ? <small>{gstNote}</small> : null}
                            </td>
                            <td>
                              {planRowName ? <span className="cb-bill__tag">{planRowName}</span> : (
                                <span className="cb-bill__mu">—</span>
                              )}
                            </td>
                            <td className="r">
                              {row.taxablePaise != null ? inr(row.taxablePaise) : (
                                <span className="cb-bill__mu">—</span>
                              )}
                            </td>
                            <td className="r">
                              {row.gstPaise != null ? inr(row.gstPaise) : (
                                <span className="cb-bill__mu">—</span>
                              )}
                            </td>
                            <td className="r cb-bill__tot">{inr(row.amountPaise)}</td>
                            <td>
                              {row.invoiceId ? (
                                <Link
                                  href={`/employer/payments/invoices/${row.invoiceId}`}
                                  className="cb-bill__inv"
                                >
                                  {row.invoiceNumber || 'View'}
                                </Link>
                              ) : (
                                <span className="cb-bill__mu">—</span>
                              )}
                            </td>
                            <td>
                              {paid ? (
                                <span className="cb-bill__pill cb-bill__pill--act">
                                  <i />
                                  Paid
                                </span>
                              ) : (
                                <span className="cb-bill__pill cb-bill__pill--warn">
                                  <i />
                                  {row.status || 'Pending'}
                                </span>
                              )}
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
      </div>
    </EmployerShellFallback>
  );
}
