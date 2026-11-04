'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import {
  getReferralDashboard,
  submitReferralPayout,
  type ReferralDashboard,
} from '@/lib/api';
import { notifyReferralPoints, whatsAppShareUrl } from '@/lib/referral-attr';
import { userFacingError } from '@/lib/client-errors';
import './refer-earn.css';

export default function ReferEarnPage() {
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [upiId, setUpiId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const next = await getReferralDashboard();
      setData(next);
      notifyReferralPoints(next.stats.pointsBalance);
    } catch (err) {
      setError(userFacingError(err, 'load Refer & Earn'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const shareUrl = useMemo(() => {
    if (!data) return '';
    if (typeof window === 'undefined') return data.sharePath;
    return `${window.location.origin}${data.sharePath}`;
  }, [data]);

  async function onSubmitUpi(event: FormEvent) {
    event.preventDefault();
    if (!upiId.trim() || busy) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await submitReferralPayout(upiId.trim());
      setUpiId('');
      setNotice('UPI submitted. Super Admin will complete payment and update status.');
      await reload();
    } catch (err) {
      setError(userFacingError(err, 'submit UPI'));
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    void navigator.clipboard?.writeText(shareUrl);
    setNotice('Referral link copied.');
  }

  const progressToPayout = data
    ? Math.min(100, Math.round((data.stats.pointsBalance / data.stats.pointsToPayoutEligible) * 100))
    : 0;

  return (
    <CandidateAppShell activeTab="refer" title="Refer & Earn" maxWidth="max-w-5xl">
      <div className="re-stage">
        <div className="re-hero">
          <div>
            <p className="re-brand">CareerBridge · Refer & Earn</p>
            <h1 className="re-headline">Share your bridge. Earn on every join.</h1>
            <p className="re-support">
              Send your personal link. When friends register successfully, you earn points. At 100
              points, unlock UPI payout.
            </p>
          </div>

          {data ? (
            <div className="re-score" aria-label={`${data.stats.pointsBalance} points`}>
              <span className="re-score__label">Your points</span>
              <strong className="re-score__value">{data.stats.pointsBalance}</strong>
              <span className="re-score__meta">
                {data.stats.pointsBalance} / {data.stats.pointsToPayoutEligible} to UPI
              </span>
              <div className="re-meter" aria-hidden>
                <span style={{ width: `${progressToPayout}%` }} />
              </div>
            </div>
          ) : null}
        </div>

        {loading && !data ? <p className="re-muted">Loading your referral desk…</p> : null}
        {error ? <div className="re-alert re-alert--bad">{error}</div> : null}
        {notice ? <div className="re-alert re-alert--ok">{notice}</div> : null}

        {data ? (
          <>
            <p className="re-track">
              <strong>{data.referrerKind === 'FRESHER' ? 'Fresher track' : 'Experienced track'}.</strong>{' '}
              {data.referrerKind === 'FRESHER'
                ? `${data.rules.fresherBatchSize} successful registrations → ${data.rules.pointsPerBatch} points.`
                : `${data.rules.experiencedBatchSize} successful registration → ${data.rules.pointsPerBatch} points.`}{' '}
              {data.stats.referralsNeededForNextBatch} more for the next batch.
            </p>

            <section className="re-ticket" aria-label="Share referral link">
              <div className="re-ticket__main">
                <h2>Your invite link</h2>
                <span className="re-ticket__code">{data.referralCode}</span>
                <a className="re-link" href={shareUrl} target="_blank" rel="noreferrer">
                  {shareUrl}
                </a>
                <div className="re-actions">
                  <button type="button" className="re-btn re-btn--primary" onClick={copyLink}>
                    Copy link
                  </button>
                  <a
                    className="re-btn re-btn--ghost"
                    href={whatsAppShareUrl(shareUrl, data.referralCode)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <a className="re-btn re-btn--ghost" href={shareUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
              </div>
              <aside className="re-ticket__stub" aria-hidden>
                <span>Code</span>
                <strong>{data.referralCode.slice(0, 6)}</strong>
              </aside>
            </section>

            <div className="re-rail">
              <article>
                <p>Successful</p>
                <strong>{data.stats.approvedReferrals}</strong>
                <span>referrals landed</span>
              </article>
              <article>
                <p>Next batch</p>
                <strong>{data.stats.referralsNeededForNextBatch}</strong>
                <span>registrations left</span>
              </article>
              <article>
                <p>Payout gate</p>
                <strong>{data.stats.pointsToPayoutEligible}</strong>
                <span>points required</span>
              </article>
            </div>

            {data.stats.payoutEligible || data.pendingPayout ? (
              <section className="re-upi">
                <h2>UPI payout</h2>
                {data.pendingPayout ? (
                  <p className="re-muted">
                    Pending for <strong>{data.pendingPayout.upiId}</strong> (
                    {data.pendingPayout.pointsAtRequest} points). Super Admin will mark it paid.
                  </p>
                ) : (
                  <form onSubmit={onSubmitUpi} className="re-upi__form">
                    <input
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="yourname@upi"
                      required
                      autoComplete="off"
                      inputMode="email"
                    />
                    <button type="submit" disabled={busy} className="re-btn re-btn--primary">
                      {busy ? 'Submitting…' : 'Submit UPI'}
                    </button>
                  </form>
                )}
              </section>
            ) : null}

            <section className="re-list">
              <h2>Referrals</h2>
              {data.referrals.length === 0 ? (
                <p className="re-muted">Nobody yet — copy your link and send the first invite.</p>
              ) : (
                <ul>
                  {data.referrals.map((row) => (
                    <li key={row.id}>
                      <div>
                        <strong>{row.referredName}</strong>
                        <span>{row.referredPhoneMasked}</span>
                      </div>
                      <em>{row.status}</em>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.payouts.length > 0 ? (
              <section className="re-list">
                <h2>Payout history</h2>
                <ul>
                  {data.payouts.map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{p.upiId}</strong>
                        <span>{p.pointsAtRequest} pts</span>
                      </div>
                      <em>{p.status}</em>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </CandidateAppShell>
  );
}
