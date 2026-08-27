'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HUMAN_INTERVIEW_PRICE_INR, HUMAN_MOCK_RULES } from '@careerbridge/shared';
import { CandidateShell } from '@/components/CandidatePortal';
import { SkillMascot } from '@/components/SkillMascot';
import { humanInterviewPaid, markHumanInterviewPaid } from '@/lib/human-interview-pay';

export default function HumanInterviewPayPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [upi, setUpi] = useState('');
  const [card, setCard] = useState('');

  useEffect(() => {
    const ok = humanInterviewPaid();
    setPaid(ok);
    setReady(true);
  }, []);

  async function onPay(event: FormEvent) {
    event.preventDefault();
    if (upi.trim().length < 3 && card.replace(/\s/g, '').length < 4) {
      setError('Enter a UPI ID or last 4 card digits. This is a static checkout only.');
      return;
    }
    setPaying(true);
    setError('');
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    markHumanInterviewPaid();
    router.push('/interviews/human/schedule');
  }

  return (
    <CandidateShell>
      <div className="cb-hire is-wide">
        <Link href="/interviews" className="cb-hire-back">
          ← Interviews
        </Link>
        <ol className="cb-hire-steps">
          <li className="is-on cb-hire-shimmer">1 Pay</li>
          <li>2 Schedule</li>
          <li>3 Meet</li>
        </ol>
        <h1>Human interview</h1>
        <p className="cb-hire-lead">
          Pay first. Then choose Technical or Non-technical and pick your meeting time. Checkout is static for now.
        </p>

        <div className="cb-hire-stage">
          <article className="cb-hire-hero">
            <SkillMascot pose="coach" className="cb-hire-eagle" alt="CareerBridge eagle" />
            <p>Live interview</p>
            <b>₹{HUMAN_INTERVIEW_PRICE_INR}</b>
            <span>READY</span>
            <ul>
              <li>Technical or Non-technical interview</li>
              <li>Room opens 5 minutes before</li>
              <li>Transcript + score after</li>
            </ul>
          </article>

          {!ready ? (
            <p className="cb-hire-note">Checking payment…</p>
          ) : paid ? (
            <section className="cb-hire-card">
              <p className="cb-hire-ok">Payment already marked for this session.</p>
              <Link href="/interviews/human/schedule" className="cb-hire-btn cb-hire-shimmer">
                Continue to schedule
              </Link>
            </section>
          ) : (
            <form onSubmit={onPay} className="cb-hire-card">
              <p className="cb-hire-kicker">Static checkout</p>
              <label>
                UPI ID
                <input
                  value={upi}
                  onChange={(event) => setUpi(event.target.value)}
                  placeholder="name@upi"
                />
              </label>
              <p className="cb-hire-or">or</p>
              <label>
                Card last 4 digits
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={card}
                  onChange={(event) => setCard(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                />
              </label>
              {error ? <p className="cb-hire-alert">{error}</p> : null}
              <button type="submit" disabled={paying} className="cb-hire-btn cb-hire-shimmer">
                {paying ? 'Paying…' : `Pay ₹${HUMAN_INTERVIEW_PRICE_INR}`}
              </button>
              <p className="cb-hire-note">No real money is taken. This only unlocks scheduling.</p>
            </form>
          )}
        </div>

        <ol className="cb-hire-rules">
          {HUMAN_MOCK_RULES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    </CandidateShell>
  );
}
