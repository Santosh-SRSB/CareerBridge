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
  const [copied, setCopied] = useState(false);

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
    setCopied(true);
    setNotice('Referral link copied.');
    window.setTimeout(() => setCopied(false), 1600);
  }

  const progressToPayout = data
    ? Math.min(100, Math.round((data.stats.pointsBalance / data.stats.pointsToPayoutEligible) * 100))
    : 0;

  return (
    <CandidateAppShell activeTab="refer" title="Refer & Earn" maxWidth="max-w-4xl">
      <div className="re-page">
        <header className="re-header">
          <div>
            <p className="re-kicker">Refer & Earn</p>
            <h1 className="re-title">Invite friends. Earn real cash.</h1>
            <p className="re-lead">
              Share your link. Successful registrations earn points. At 100 points, unlock UPI
              payout.
            </p>
          </div>
          {data ? (
            <div className="re-points" aria-label={`${data.stats.pointsBalance} points`}>
              <span>Points</span>
              <strong>{data.stats.pointsBalance}</strong>
              <div className="re-bar" aria-hidden>
                <i style={{ width: `${progressToPayout}%` }} />
              </div>
              <small>
                {data.stats.pointsBalance} / {data.stats.pointsToPayoutEligible} to UPI
              </small>
            </div>
          ) : null}
        </header>

        {loading && !data ? <p className="re-note">Loading…</p> : null}
        {error ? <div className="re-msg re-msg--bad">{error}</div> : null}
        {notice ? <div className="re-msg re-msg--ok">{notice}</div> : null}

        {data ? (
          <>
            <p className="re-rule">
              <strong>{data.referrerKind === 'FRESHER' ? 'Fresher track' : 'Experienced track'}.</strong>{' '}
              {data.referrerKind === 'FRESHER'
                ? `${data.rules.fresherBatchSize} joins → ${data.rules.pointsPerBatch} points.`
                : `${data.rules.experiencedBatchSize} join → ${data.rules.pointsPerBatch} points.`}{' '}
              {data.stats.referralsNeededForNextBatch} more for the next batch.
            </p>

            <section className="re-panel" aria-label="Share referral link">
              <div className="re-panel__row">
                <h2>Your referral link</h2>
                <code>{data.referralCode}</code>
              </div>
              <a className="re-url" href={shareUrl} target="_blank" rel="noreferrer">
                {shareUrl}
              </a>
              <div className="re-actions">
                <button type="button" className="re-btn re-btn--main" onClick={copyLink}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  className="re-btn"
                  href={whatsAppShareUrl(shareUrl, data.referralCode)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
                <a className="re-btn" href={shareUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              </div>
            </section>

            <div className="re-stats">
              <div>
                <span>Successful</span>
                <strong>{data.stats.approvedReferrals}</strong>
              </div>
              <div>
                <span>Next batch</span>
                <strong>{data.stats.referralsNeededForNextBatch}</strong>
              </div>
              <div>
                <span>Payout at</span>
                <strong>{data.stats.pointsToPayoutEligible}</strong>
              </div>
            </div>

            {data.stats.payoutEligible || data.pendingPayout ? (
              <section className="re-panel">
                <h2>UPI payout</h2>
                {data.pendingPayout ? (
                  <p className="re-note">
                    Pending for <strong>{data.pendingPayout.upiId}</strong> (
                    {data.pendingPayout.pointsAtRequest} points).
                  </p>
                ) : (
                  <form onSubmit={onSubmitUpi} className="re-form">
                    <input
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="yourname@upi"
                      required
                      autoComplete="off"
                      inputMode="email"
                    />
                    <button type="submit" disabled={busy} className="re-btn re-btn--main">
                      {busy ? 'Submitting…' : 'Submit UPI'}
                    </button>
                  </form>
                )}
              </section>
            ) : null}

            <section className="re-panel">
              <h2>Referrals</h2>
              {data.referrals.length === 0 ? (
                <p className="re-note">No referrals yet. Share your link to get started.</p>
              ) : (
                <ul className="re-rows">
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
              <section className="re-panel">
                <h2>Payout history</h2>
                <ul className="re-rows">
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
