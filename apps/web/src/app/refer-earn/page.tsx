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

function ReferCartoon({ points }: { points: number }) {
  return (
    <div className="re-cast" aria-hidden>
      <svg className="re-cast__scene" viewBox="0 0 360 220" role="img">
        <defs>
          <linearGradient id="reSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d9f4ff" />
            <stop offset="100%" stopColor="#f0fbff" />
          </linearGradient>
          <linearGradient id="reBridge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0b1f4a" />
            <stop offset="100%" stopColor="#1a4f9c" />
          </linearGradient>
        </defs>

        <rect width="360" height="220" rx="28" fill="url(#reSky)" />

        {/* floating coins */}
        <g className="re-coin re-coin--a">
          <circle cx="48" cy="42" r="16" fill="#f5c518" stroke="#d4a017" strokeWidth="3" />
          <text x="48" y="48" textAnchor="middle" fontSize="14" fontWeight="800" fill="#7a5a00">
            ₹
          </text>
        </g>
        <g className="re-coin re-coin--b">
          <circle cx="300" cy="38" r="13" fill="#f5c518" stroke="#d4a017" strokeWidth="3" />
          <text x="300" y="43" textAnchor="middle" fontSize="11" fontWeight="800" fill="#7a5a00">
            ₹
          </text>
        </g>
        <g className="re-coin re-coin--c">
          <circle cx="318" cy="92" r="11" fill="#ffe566" stroke="#d4a017" strokeWidth="2.5" />
          <text x="318" y="96" textAnchor="middle" fontSize="10" fontWeight="800" fill="#7a5a00">
            +
          </text>
        </g>

        {/* soft hills */}
        <ellipse cx="70" cy="210" rx="90" ry="36" fill="#b8ebc8" />
        <ellipse cx="280" cy="214" rx="100" ry="40" fill="#a6e4bc" />

        {/* bridge deck */}
        <path
          d="M40 150 C110 110, 250 110, 320 150"
          fill="none"
          stroke="url(#reBridge)"
          strokeWidth="14"
          strokeLinecap="round"
          className="re-bridge-line"
        />
        <path
          d="M55 158 C120 128, 240 128, 305 158"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="6 10"
          className="re-bridge-dash"
        />

        {/* left buddy (you) */}
        <g className="re-buddy re-buddy--you">
          <ellipse cx="88" cy="168" rx="22" ry="8" fill="#0b1f4a22" />
          <circle cx="88" cy="118" r="22" fill="#ffd7b5" />
          <circle cx="80" cy="114" r="3" fill="#0b1f4a" />
          <circle cx="96" cy="114" r="3" fill="#0b1f4a" />
          <path d="M80 126 Q88 132 96 126" fill="none" stroke="#0b1f4a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M68 140 Q88 168 108 140" fill="#0f9d8a" />
          <circle cx="88" cy="102" r="10" fill="#0b1f4a" />
          <rect x="70" y="96" width="36" height="10" rx="5" fill="#132b63" />
          {/* waving arm */}
          <g className="re-wave">
            <path d="M108 148 Q128 132 138 118" fill="none" stroke="#ffd7b5" strokeWidth="7" strokeLinecap="round" />
            <circle cx="140" cy="114" r="7" fill="#ffd7b5" />
          </g>
        </g>

        {/* flying invite chip */}
        <g className="re-chip">
          <rect x="155" y="96" width="58" height="28" rx="10" fill="#0b1f4a" />
          <text x="184" y="115" textAnchor="middle" fontSize="11" fontWeight="700" fill="#9ef0e2">
            INVITE
          </text>
        </g>

        {/* right buddy (friend) */}
        <g className="re-buddy re-buddy--pal">
          <ellipse cx="268" cy="168" rx="22" ry="8" fill="#0b1f4a22" />
          <circle cx="268" cy="118" r="22" fill="#ffc9a8" />
          <circle cx="260" cy="114" r="3" fill="#0b1f4a" />
          <circle cx="276" cy="114" r="3" fill="#0b1f4a" />
          <path d="M260 126 Q268 133 276 126" fill="none" stroke="#0b1f4a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M248 140 Q268 170 288 140" fill="#1a4f9c" />
          <circle cx="268" cy="100" r="11" fill="#f97316" />
          <g className="re-catch">
            <path d="M248 150 Q230 140 220 128" fill="none" stroke="#ffc9a8" strokeWidth="7" strokeLinecap="round" />
            <circle cx="218" cy="124" r="7" fill="#ffc9a8" />
          </g>
        </g>

        {/* points burst */}
        <g className="re-burst">
          <text x="180" y="58" textAnchor="middle" fontSize="18" fontWeight="800" fill="#0b1f4a">
            {points} pts
          </text>
        </g>
      </svg>
      <div className="re-cast__bubbles">
        <span className="re-bubble re-bubble--1" />
        <span className="re-bubble re-bubble--2" />
        <span className="re-bubble re-bubble--3" />
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
    setNotice('Referral link copied — send it to a friend!');
    window.setTimeout(() => setCopied(false), 1800);
  }

  const progressToPayout = data
    ? Math.min(100, Math.round((data.stats.pointsBalance / data.stats.pointsToPayoutEligible) * 100))
    : 0;

  return (
    <CandidateAppShell activeTab="refer" title="Refer & Earn" maxWidth="max-w-5xl">
      <div className="re-stage">
        <div className="re-hero">
          <div className="re-hero__copy">
            <p className="re-brand">CareerBridge · Refer & Earn</p>
            <h1 className="re-headline">
              Invite friends.
              <span className="re-headline__pop"> Earn cartoon cash.</span>
            </h1>
            <p className="re-support">
              Share your link, watch friends hop onto the bridge, stack points, and cash out on UPI at
              100.
            </p>
            <ol className="re-steps" aria-label="How it works">
              <li className="re-step">
                <span className="re-step__n">1</span>
                Copy link
              </li>
              <li className="re-step">
                <span className="re-step__n">2</span>
                Friend joins
              </li>
              <li className="re-step">
                <span className="re-step__n">3</span>
                Points pop
              </li>
            </ol>
          </div>

          <ReferCartoon points={data?.stats.pointsBalance ?? 0} />
        </div>

        {loading && !data ? <p className="re-muted">Warming up your invite parade…</p> : null}
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

            <section className="re-ticket" aria-label="Share referral link">
              <div className="re-ticket__main">
                <div className="re-ticket__head">
                  <h2>Your magic invite</h2>
                  <span className="re-ticket__code">{data.referralCode}</span>
                </div>
                <a className="re-link" href={shareUrl} target="_blank" rel="noreferrer">
                  {shareUrl}
                </a>
                <div className="re-actions">
                  <button
                    type="button"
                    className={`re-btn re-btn--primary${copied ? ' re-btn--pop' : ''}`}
                    onClick={copyLink}
                  >
                    {copied ? 'Copied!' : 'Copy link'}
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
                <span>Pass</span>
                <strong>{data.referralCode.slice(0, 6)}</strong>
                <i className="re-ticket__star" />
              </aside>
            </section>

            <div className="re-rail">
              <article className="re-rail__card re-rail__card--a">
                <p>Successful</p>
                <strong>{data.stats.approvedReferrals}</strong>
                <span>friends landed</span>
              </article>
              <article className="re-rail__card re-rail__card--b">
                <p>Next batch</p>
                <strong>{data.stats.referralsNeededForNextBatch}</strong>
                <span>joins left</span>
              </article>
              <article className="re-rail__card re-rail__card--c">
                <p>Payout gate</p>
                <strong>{data.stats.pointsToPayoutEligible}</strong>
                <span>points needed</span>
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
              <h2>Your crew</h2>
              {data.referrals.length === 0 ? (
                <div className="re-empty">
                  <div className="re-empty__art" aria-hidden>
                    <span className="re-empty__face" />
                    <span className="re-empty__face re-empty__face--2" />
                  </div>
                  <p className="re-muted">Nobody yet — copy your link and send the first invite.</p>
                </div>
              ) : (
                <ul>
                  {data.referrals.map((row, i) => (
                    <li key={row.id} style={{ animationDelay: `${120 + i * 60}ms` }}>
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
                  {data.payouts.map((p, i) => (
                    <li key={p.id} style={{ animationDelay: `${120 + i * 60}ms` }}>
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
