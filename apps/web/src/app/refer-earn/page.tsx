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

function shareMessage(shareUrl: string, referralCode: string) {
  return [
    shareUrl,
    '',
    'Join me on CareerBridge — build your Career Passport and apply to jobs.',
    `Referral code: ${referralCode}`,
  ].join('\n');
}

function linkedInShareUrl(shareUrl: string) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
}

function emailShareUrl(shareUrl: string, referralCode: string) {
  const subject = encodeURIComponent('Join me on CareerBridge');
  const body = encodeURIComponent(shareMessage(shareUrl, referralCode));
  return `mailto:?subject=${subject}&body=${body}`;
}

function statusTone(status: string) {
  const key = status.toUpperCase();
  if (key.includes('APPROV') || key.includes('JOIN') || key.includes('SUCCESS')) return 'joined';
  if (key.includes('PEND') || key.includes('INVIT')) return 'invited';
  return 'neutral';
}

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

  function shareInstagram() {
    if (!shareUrl || !data) return;
    void navigator.clipboard?.writeText(shareMessage(shareUrl, data.referralCode));
    setNotice('Link copied — paste it in Instagram (DM or bio).');
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  }

  const progressToPayout = data
    ? Math.min(100, Math.round((data.stats.pointsBalance / data.stats.pointsToPayoutEligible) * 100))
    : 0;

  return (
    <CandidateAppShell activeTab="refer" title="Refer & Earn" maxWidth="max-w-5xl">
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
            <div className="re-rule">
              <p>
                <strong>Your track: {data.referrerKind === 'FRESHER' ? 'Fresher' : 'Experienced'}.</strong>{' '}
                {data.stats.referralsNeededForNextBatch} more successful join
                {data.stats.referralsNeededForNextBatch === 1 ? '' : 's'} for your next points batch.
              </p>
              <ul>
                <li>
                  <strong>Fresher:</strong> every {data.rules.fresherBatchSize} successful joins →{' '}
                  {data.rules.pointsPerBatch} points
                </li>
                <li>
                  <strong>Experienced:</strong> every {data.rules.experiencedBatchSize} successful join →{' '}
                  {data.rules.pointsPerBatch} points
                </li>
              </ul>
            </div>

            <div className="re-stats">
              <div>
                <span>Friends invited</span>
                <strong>{data.referrals.length}</strong>
              </div>
              <div>
                <span>Joined</span>
                <strong>{data.stats.approvedReferrals}</strong>
              </div>
              <div>
                <span>Next batch</span>
                <strong>{data.stats.referralsNeededForNextBatch}</strong>
              </div>
              <div className="re-stats__hi">
                <span>Points</span>
                <strong>{data.stats.pointsBalance}</strong>
              </div>
            </div>

            <div className="re-grid">
              <section className="re-panel" aria-label="Referrals">
                <h2>Your referrals</h2>
                {data.referrals.length === 0 ? (
                  <p className="re-note">No referrals yet. Share your link to get started.</p>
                ) : (
                  <div className="re-table-wrap">
                    <table className="re-table">
                      <thead>
                        <tr>
                          <th>Friend</th>
                          <th>Phone</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.referrals.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.referredName}</strong>
                            </td>
                            <td>{row.referredPhoneMasked}</td>
                            <td>
                              <em className={`re-pill re-pill--${statusTone(row.status)}`}>
                                {row.status}
                              </em>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="re-panel re-invite" aria-label="Share referral link">
                <h2>Invite a friend</h2>
                <p className="re-invite__hint">
                  Code <code>{data.referralCode}</code>
                </p>
                <label className="re-invite__label" htmlFor="re-share-url">
                  Referral link
                </label>
                <input
                  id="re-share-url"
                  className="re-invite__input"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
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
                  <a
                    className="re-btn"
                    href={linkedInShareUrl(shareUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    LinkedIn
                  </a>
                  <a className="re-btn" href={emailShareUrl(shareUrl, data.referralCode)}>
                    Email
                  </a>
                  <button type="button" className="re-btn" onClick={shareInstagram}>
                    Instagram
                  </button>
                  <a className="re-btn" href={shareUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
              </section>
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
                      <em className={`re-pill re-pill--${statusTone(p.status)}`}>{p.status}</em>
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
