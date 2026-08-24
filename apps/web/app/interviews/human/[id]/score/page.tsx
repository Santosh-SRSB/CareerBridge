'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { HumanMockSession } from '@careerbridge/shared';
import { getHumanMock } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { SkillMascot } from '@/components/SkillMascot';

function ScoreRing({ value }: { value: number }) {
  const radius = 52;
  const ring = 2 * Math.PI * radius;
  const offset = ring - (Math.max(0, Math.min(100, value)) / 100) * ring;
  return (
    <div className="cb-hire-ring" aria-label={`Overall score ${value}`}>
      <svg viewBox="0 0 128 128" aria-hidden>
        <circle className="is-track" cx="64" cy="64" r={radius} />
        <circle className="is-value" cx="64" cy="64" r={radius} strokeDasharray={ring} strokeDashoffset={offset} />
      </svg>
      <b>{value}</b>
    </div>
  );
}

export default function HumanMockScorePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<HumanMockSession | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getHumanMock(params.id)
      .then(setSession)
      .catch((err) => {
        const code = (err as { code?: string }).code;
        if (code === 'UNAUTHORIZED') router.replace('/login');
      });
  }, [params.id, router]);

  if (!session?.feedback) {
    return (
      <CandidateShell>
        <div className="cb-hire is-wide">
          <section className="cb-hire-result">
            <div className="cb-hire-hero">
              <SkillMascot pose="graduate" className="cb-hire-eagle" alt="" />
              <p>Interview result</p>
              <b>Scoring your session</b>
              <span className="cb-hire-shimmer">Reading transcript</span>
            </div>
            <div className="cb-hire-scorecard">
              <div className="cb-hire-skel is-ring cb-hire-shimmer" />
              <div className="cb-hire-skel cb-hire-shimmer" />
              <div className="cb-hire-skel is-short cb-hire-shimmer" />
            </div>
          </section>
        </div>
      </CandidateShell>
    );
  }

  const feedback = session.feedback;
  const emptyTalk = !session.transcript?.trim();
  const transcript =
    session.transcript?.trim() ||
    'No speech was captured. Allow the microphone next time, then tap Start in the live room.';
  const metrics = [
    { label: 'Talk', hint: 'Communication', value: feedback.communication },
    { label: 'Shape', hint: 'Structure', value: feedback.structure },
    { label: 'Fit', hint: 'Role match', value: feedback.relevance },
    { label: 'Ease', hint: 'Confidence', value: feedback.confidence },
  ];
  const when = session.scheduledAt
    ? new Date(session.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  async function copyTranscript() {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
  }

  function downloadTranscript() {
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interview-transcript-${session?.jobRole || 'careerbridge'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <CandidateShell>
      <div className="cb-hire is-wide">
        <Link href="/interviews" className="cb-hire-back">
          ← Interviews
        </Link>

        <section className="cb-hire-result">
          <div className="cb-hire-hero">
            <SkillMascot pose="graduate" className="cb-hire-eagle" alt="CareerBridge eagle" />
            <p>Interview result</p>
            <b>{session.jobRole}</b>
            <span className="cb-hire-shimmer">{session.interviewerName || 'Priya Kumari'}</span>
            {when ? <em className="cb-hire-when">{when}</em> : null}
          </div>
          <div className="cb-hire-scorecard">
            <ScoreRing value={feedback.score} />
            <p className="cb-hire-kicker">Overall score</p>
            <p className="cb-hire-note">Scored from your spoken transcript. Live video was not saved.</p>
          </div>
        </section>

        <section className="cb-hire-card">
          <p className="cb-hire-kicker">Transcript</p>
          {emptyTalk ? (
            <div className="cb-hire-empty">
              <SkillMascot pose="idea" className="cb-hire-bulb" alt="" />
              <div>
                <p className="cb-hire-empty-title">Nothing to score from speech</p>
                <p>{transcript}</p>
              </div>
            </div>
          ) : (
            <pre className="cb-hire-script">{transcript}</pre>
          )}
          <div className="cb-hire-row">
            <button type="button" className="cb-hire-ghost" onClick={() => void copyTranscript()}>
              {copied ? 'Copied' : 'Copy transcript'}
            </button>
            <button type="button" className="cb-hire-ghost" onClick={downloadTranscript}>
              Download transcript
            </button>
          </div>
        </section>

        <div className="cb-hire-metrics is-four">
          {metrics.map((item) => (
            <div key={item.label} className="cb-hire-card is-metric">
              <p className="cb-hire-metric">
                <span>
                  {item.label}
                  <small>{item.hint}</small>
                </span>
                <b>{item.value}</b>
              </p>
              <div className="cb-hire-bar">
                <span className="cb-hire-shimmer" style={{ width: `${Math.max(item.value, 4)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="cb-hire-metrics">
          <section className="cb-hire-card">
            <p className="cb-hire-kicker">Did well</p>
            {feedback.strengths.length ? (
              <ul className="cb-hire-list">
                {feedback.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <div className="cb-hire-empty">
                <SkillMascot pose="idea" className="cb-hire-bulb" alt="" />
                <p>Stay in the room with camera and mic on so we can score your answers.</p>
              </div>
            )}
          </section>
          <section className="cb-hire-card">
            <div className="cb-hire-tip">
              <SkillMascot pose="idea" className="cb-hire-bulb" alt="" />
              <p className="cb-hire-kicker">Next</p>
            </div>
            <ul className="cb-hire-list">
              {feedback.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <Link href="/interviews/human" className="cb-hire-btn cb-hire-shimmer">
          Book another interview
        </Link>
      </div>
    </CandidateShell>
  );
}
