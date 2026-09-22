'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getEmployerDashboard, listEmployerPayments, type EmployerPaymentRow } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';

/**
 * Handbook UT-E26 — billing / credits view.
 * Platform hiring is free for now; this screen still shows plan + usage so employers
 * have a clear commercial status instead of a silent redirect.
 */
export default function EmployerBillingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState(0);
  const [shortlisted, setShortlisted] = useState(0);
  const [interviews, setInterviews] = useState(0);
  const [payments, setPayments] = useState<EmployerPaymentRow[]>([]);

  useEffect(() => {
    Promise.all([getEmployerDashboard(), listEmployerPayments().catch(() => [] as EmployerPaymentRow[])])
      .then(([dash, rows]) => {
        setApplications(dash.applications);
        setShortlisted(dash.shortlisted);
        setInterviews(dash.interviews);
        setPayments(rows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load billing.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <EmployerShellFallback title="Billing">
      <div className="ep-billing ep-page">
        <header className="ep-billing__head">
          <div>
            <p className="ep-billing__eyebrow">Plan &amp; usage</p>
            <h1 className="ep-billing__title">Billing</h1>
            <p className="ep-billing__sub">Hiring on CareerBridge is free while we scale with you.</p>
          </div>
          <Link href="/employer" className="ep-billing__back">
            ← Dashboard
          </Link>
        </header>

        {error ? <p className="ep-billing__alert">{error}</p> : null}
        {loading ? <p className="ep-billing__muted">Loading billing…</p> : null}

        {!loading ? (
          <>
            <section className="ep-billing__plan" aria-label="Current plan">
              <div>
                <p className="ep-billing__plan-label">Current plan</p>
                <h2>Starter · Free</h2>
                <p>Unlimited job posts, candidate search, shortlists, and interviews.</p>
              </div>
              <div className="ep-billing__credits" aria-label="Credits remaining">
                <p className="ep-billing__plan-label">Credits remaining</p>
                <strong>Unlimited</strong>
                <div className="ep-billing__bar" aria-hidden>
                  <span style={{ width: '100%' }} />
                </div>
                <em>No credit purchase required</em>
              </div>
            </section>

            <section className="ep-billing__usage" aria-label="Usage this month">
              <h3>Usage overview</h3>
              <ul>
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
              {payments.length === 0 ? (
                <p className="ep-billing__muted">No paid transactions yet — your workspace is on the free plan.</p>
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
