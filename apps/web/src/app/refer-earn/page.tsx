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

function CashHeroArt({ points, progress }: { points: number; progress: number }) {
  return (
    <div className="re-cash" aria-hidden>
      <div className="re-cash__glow" />
      <div className="re-cash__stack re-cash__stack--back">
        <span />
        <span />
        <span />
      </div>
      <div className="re-cash__note re-cash__note--main">
        <div className="re-cash__note-top">
          <em>INR</em>
          <strong>100</strong>
        </div>
        <div className="re-cash__note-mid">
          <b>₹</b>
          <span>CareerBridge payout</span>
        </div>
        <div className="re-cash__note-bot">
          <i />
          <small>UPI ready at 100 pts</small>
        </div>
      </div>
      <div className="re-cash__coin re-cash__coin--1">₹</div>
      <div className="re-cash__coin re-cash__coin--2">₹</div>
      <div className="re-cash__coin re-cash__coin--3">₹</div>
      <div className="re-cash__meter">
        <div className="re-cash__meter-fill" style={{ width: `${progress}%` }} />
        <p>
          <strong>{points}</strong>
          <span> pts banked</span>
        </p>
      </div>
    </div>
  );
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

  const progressToPayout = data
    ? Math.min(100, Math.round((data.stats.pointsBalance / data.stats.pointsToPayoutEligible) * 100))
    : 0;

  return (
    <CandidateAppShell activeTab="refer" title="Refer & Earn" maxWidth="max-w-5xl">
      <div className="re-stage">
        <section className="re-hero">
          <div className="re-hero__copy">
            <p className="re-brand">CareerBridge · Refer & Earn</p>
            <h1 className="re-headline">
              Invite friends.
              <span className="re-headline__accent"> Earn real cash.</span>
            </h1>
            <p className="re-support">
              Share your personal link. Successful registrations build points. At 100 points, unlock
              UPI payout.
            </p>
            <ol className="re-steps" aria-label="How it works">
              <li>
                <span>1</span>
                Copy link
              </li>
              <li>
                <span>2</span>
                Friend joins
              </li>
              <li>
                <span>3</span>
                Cash out
              </li>
            </ol>
          </div>
          <CashHeroArt points={data?.stats.pointsBalance ?? 0} progress={progressToPayout} />
        </section>

        {loading && !data ? <p className="re-muted">Loading your referral desk…</p> : null}
        {error ? <div className="re-alert re-alert--bad">{error}</div> : null}
        {notice ? <div className="re-alert re-alert--ok">{notice}</div> : null}

        {data ? (
          <>
            <div className="re-scoreboard">
              <div className="re-score" aria-label={`${data.stats.pointsBalance} points`}>
                <span className="re-score__label">Points bank</span>
                <strong className="re-score__value">{data.stats.pointsBalance}</strong>
                <span className="re-score__meta">
                  {data.stats.pointsBalance} / {data.stats.pointsToPayoutEligible} to UPI
                </span>
                <div className="re-meter" aria-hidden>
                  <span style={{ width: `${progressToPayout}%` }} />
                </div>
              </div>
              <p className="re-track">
                <strong>{data.referrerKind === 'FRESHER' ? 'Fresher track' : 'Experienced track'}.</strong>{' '}
                {data.referrerKind === 'FRESHER'
                  ? `${data.rules.fresherBatchSize} joins → ${data.rules.pointsPerBatch} points.`
                  : `${data.rules.experiencedBatchSize} join → ${data.rules.pointsPerBatch} points.`}{' '}
                {data.stats.referralsNeededForNextBatch} more for the next batch.
              </p>
            </div>

            <section className="re-share" aria-label="Share referral link">
              <div className="re-share__main">
                <div className="re-share__head">
                  <h2>Your referral link</h2>
                  <span className="re-code">{data.referralCode}</span>
                </div>
                <a className="re-link" href={shareUrl} target="_blank" rel="noreferrer">
                  {shareUrl}
                </a>
                <div className="re-actions">
                  <button
                    type="button"
                    className={`re-btn re-btn--primary${copied ? ' re-btn--done' : ''}`}
                    onClick={copyLink}
                  >
                    {copied ? 'Copied' : 'Copy link'}
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
              <aside className="re-share__pass" aria-hidden>
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
                <span>joins remaining</span>
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
                      <div className="re-avatar" aria-hidden>
                        {(row.referredName || '?').slice(0, 1).toUpperCase()}
                      </div>
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
