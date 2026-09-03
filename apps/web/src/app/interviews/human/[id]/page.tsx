'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { humanInterviewJoinState, type HumanMockSession } from '@careerbridge/shared';
import { getHumanMock } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { HumanInterviewArt } from '@/components/HumanInterviewArt';
import { HumanInterviewGate } from '@/components/HumanInterviewGate';

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
          <section className="cb-hire-meet">
            <HumanInterviewArt />
            <div className="cb-hire-meet-body">
              <p className="cb-hire-kicker">Booked meeting</p>
              <b className="cb-hire-meet-title">Loading your booking…</b>
            </div>
          </section>
        </div>
      </CandidateShell>
    );
  }

  const join = humanInterviewJoinState(session.scheduledAt, now);
  const done = session.status === 'COMPLETED';
  const open = join.canJoin || session.status === 'LIVE';

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
          <li className="is-on">3 Meet</li>
        </ol>

        <section className="cb-hire-meet">
          <HumanInterviewArt priority />
          <div className="cb-hire-meet-body">
            <p className="cb-hire-kicker">Booked meeting</p>
            <h1 className="cb-hire-meet-title">{session.jobRole}</h1>
            <p className="cb-hire-meet-when">{whenLabel(session.scheduledAt)}</p>
            <ul className="cb-hire-meet-meta">
              <li>
                {session.candidateName || 'You'} with {session.interviewerName || 'Interviewer'}
              </li>
              {session.candidateEmail ? <li>{session.candidateEmail}</li> : null}
              <li>
                {session.emailSent
                  ? 'Invite sent to your email and to the interviewer.'
                  : 'Join from here if email is not set up yet.'}
              </li>
            </ul>

            {done ? (
              <Link href={`/interviews/human/${session.id}/score`} className="cb-hire-btn">
                See score
              </Link>
            ) : open ? (
              <div className="cb-hire-meet-action">
                <p className="cb-hire-ok">The live room is open. You can enter now.</p>
                <Link href={`/interviews/human/${session.id}/room`} className="cb-hire-btn">
                  Enter live room
                </Link>
              </div>
            ) : (
              <HumanInterviewGate session={session} compact />
            )}

            <div className="cb-hire-meet-link">
              <p className="cb-hire-kicker">Interviewer link</p>
              <code className="cb-hire-code">{session.interviewerJoinUrl}</code>
              <button
                type="button"
                className="cb-hire-ghost"
                onClick={() => void copy(session.interviewerJoinUrl)}
              >
                {copied ? 'Copied' : 'Copy interviewer link'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </CandidateShell>
  );
}
