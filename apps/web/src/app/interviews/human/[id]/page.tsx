'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { humanInterviewJoinState, type HumanMockSession } from '@careerbridge/shared';
import { getHumanMock } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { HumanInterviewGate } from '@/components/HumanInterviewGate';
import { SkillMascot } from '@/components/SkillMascot';

function whenLabel(value: string) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function HumanMockDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<HumanMockSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getHumanMock(params.id)
      .then(setSession)
      .catch((err) => {
        const code = (err as { code?: string }).code;
        if (code === 'UNAUTHORIZED') router.replace('/login');
      });
  }, [params.id, router]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  if (!session) {
    return (
      <CandidateShell>
        <div className="cb-hire is-wide">
          <section className="cb-hire-hero">
            <SkillMascot pose="guide" className="cb-hire-eagle" alt="" />
            <p>Booked meeting</p>
            <b>Loading your booking…</b>
            <span className="cb-hire-shimmer">Please wait</span>
          </section>
        </div>
      </CandidateShell>
    );
  }

  const join = humanInterviewJoinState(session.scheduledAt, now);
  const done = session.status === 'COMPLETED';

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <CandidateShell>
      <div className="cb-hire is-wide">
        <Link href="/interviews" className="cb-hire-back">
          ← Interviews
        </Link>
        <ol className="cb-hire-steps">
          <li>1 Pay</li>
          <li>2 Schedule</li>
          <li className="is-on cb-hire-shimmer">3 Meet</li>
        </ol>

        <div className="cb-hire-stage">
          <aside className="cb-hire-hero">
            <SkillMascot pose="guide" className="cb-hire-eagle" alt="CareerBridge eagle" />
            <p>Booked meeting</p>
            <b>{session.jobRole}</b>
            <span className="cb-hire-shimmer">{whenLabel(session.scheduledAt)}</span>
            <ul>
              <li>
                {session.candidateName || 'You'} with {session.interviewerName || 'Interviewer'}
              </li>
              {session.candidateEmail ? <li>{session.candidateEmail}</li> : null}
              <li>
                {session.emailSent ? 'Invite sent to your email and to the interviewer.' : 'Join from here if email is not set up yet.'}
              </li>
            </ul>
          </aside>

          <div>
            {done ? (
              <Link href={`/interviews/human/${session.id}/score`} className="cb-hire-btn cb-hire-shimmer">
                See score
              </Link>
            ) : join.canJoin || session.status === 'LIVE' ? (
              <section className="cb-hire-card">
                <p className="cb-hire-ok">The live room is open now. You can enter.</p>
                <Link href={`/interviews/human/${session.id}/room`} className="cb-hire-btn cb-hire-shimmer">
                  Enter live room
                </Link>
              </section>
            ) : (
              <HumanInterviewGate session={session} compact />
            )}

            <section className="cb-hire-card">
              <p className="cb-hire-kicker">Interviewer link</p>
              <code className="cb-hire-code">{session.interviewerJoinUrl}</code>
              <button type="button" className="cb-hire-ghost" onClick={() => void copy(session.interviewerJoinUrl)}>
                {copied ? 'Copied' : 'Copy interviewer link'}
              </button>
            </section>
          </div>
        </div>
      </div>
    </CandidateShell>
  );
}
