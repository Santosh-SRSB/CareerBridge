'use client';

import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SKILL_ASSESSMENT_RULES, type SkillAssessmentSession } from '@careerbridge/shared';
import { answerSkillAssessment, getSkillAssessment } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { SkillSpokenAnswer } from '@/components/SkillSpokenAnswer';
import { SkillStudioLoader } from '@/components/SkillEntryCard';
import { SkillProgress } from '@/components/SkillProgress';

type ShownQuestion = NonNullable<SkillAssessmentSession['currentQuestion']>;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AssessmentSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SkillAssessmentSession | null>(null);
  const [shown, setShown] = useState<ShownQuestion | null>(null);
  const [pending, setPending] = useState<SkillAssessmentSession | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [typedText, setTypedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [justTicked, setJustTicked] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getSkillAssessment(params.id).then((item) => {
      setSession(item);
      if (item.status === 'COMPLETED') router.replace(`/assessments/${item.id}/result`);
      if (item.currentQuestion) setShown(item.currentQuestion);
    });
  }, [params.id, router]);

  async function submitMcq(event: FormEvent) {
    event.preventDefault();
    if (selected == null) {
      setError('Tick one option, then submit.');
      return;
    }
    await send({ selectedIndex: selected });
  }

  async function send(payload: {
    selectedIndex?: number;
    text?: string;
    hasAudio?: boolean;
    hasVoice?: boolean;
    durationMs?: number;
    recording?: Blob;
  }) {
    if (loading || saved || leaving) return;
    setLoading(true);
    setError('');
    try {
      const currentIndex = shown?.index ?? session?.currentQuestion?.index ?? 0;
      const next = await answerSkillAssessment(params.id, payload);
      setJustTicked(currentIndex);
      setPending(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save that answer.');
    } finally {
      setLoading(false);
    }
  }

  async function goNext() {
    if (!pending || leaving) return;
    setLeaving(true);
    await wait(180);
    if (pending.status === 'COMPLETED' || !pending.currentQuestion) {
      router.replace(`/assessments/${pending.id}/result`);
      return;
    }
    setTypedText('');
    setSelected(null);
    setSaved(false);
    setJustTicked(null);
    setSession(pending);
    setShown(pending.currentQuestion);
    setPending(null);
    setLeaving(false);
  }

  if (!session || !shown) {
    return (
      <CandidateShell studio scene="type">
        <SkillStudioLoader />
      </CandidateShell>
    );
  }

  if (!accepted) {
    return (
      <CandidateShell studio scene="rules">
        <div className="cb-folio">
          <i className="cb-folio-tape a" />
          <header className="cb-folio-top">
            <Link href="/assessments" className="cb-folio-back">
              ← Skill check
            </Link>
            <SkillProgress total={session.totalQuestions} current={0} compact />
          </header>
          <section className="cb-folio-sheet is-rules">
            <span className="cb-folio-spine">BEFORE YOU START</span>
            <p className="cb-folio-kicker">One question at a time</p>
            <h1>
              Tick, then speak.
              <em>Face the lens.</em>
            </h1>
            <ol className="cb-folio-rules">
              {SKILL_ASSESSMENT_RULES.map((item, index) => (
                <li key={item} style={{ '--d': `${0.08 + index * 0.05}s` } as CSSProperties}>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
            <button type="button" className="cb-folio-btn" onClick={() => setAccepted(true)}>
              Start question 1
            </button>
          </section>
        </div>
      </CandidateShell>
    );
  }

  const question = shown;
  const kind = question.kind;
  const last = question.index + 1 >= session.totalQuestions;
  const busy = loading || leaving;
  const mark = String(question.index + 1).padStart(2, '0');

  if (saved) {
    return (
      <CandidateShell studio scene="ok">
        <div className="cb-folio cb-folio-filed">
          <div className="cb-folio-stamp">FILED</div>
          <p className="cb-folio-kicker">
            Question {mark} of {String(session.totalQuestions).padStart(2, '0')}
          </p>
          <h2>{question.skill}</h2>
          <p>Saved. The clip is not stored.</p>
          <button type="button" className="cb-folio-btn" disabled={leaving} onClick={() => void goNext()}>
            {leaving ? 'Opening...' : last ? 'See result' : 'Next question'}
          </button>
        </div>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell studio scene={kind === 'SPOKEN' ? 'cam' : 'type'}>
      <div className={`cb-folio ${kind === 'SPOKEN' ? 'is-cam' : 'is-mcq'}`}>
        <header className="cb-folio-top">
          <Link href="/assessments" className="cb-folio-back">
            ← Back
          </Link>
          <SkillProgress total={session.totalQuestions} current={question.index} justTicked={justTicked} compact />
          <span className="cb-folio-tag">{question.skill}</span>
        </header>

        {kind === 'SPOKEN' ? (
          <SkillSpokenAnswer
            key={question.index}
            prompt={question.prompt}
            skill={question.skill}
            index={question.index}
            total={session.totalQuestions}
            error={error}
            loading={busy}
            onSubmit={(payload) => void send(payload)}
          />
        ) : (
          <article key={question.index} className={`cb-folio-q ${leaving ? 'is-exit' : ''}`}>
            <b className="cb-folio-num" aria-hidden>
              {mark}
            </b>
            <div className="cb-folio-ruled">
              <p className="cb-folio-kicker">Tick one · then submit</p>
              <h2>{question.prompt}</h2>
              <form onSubmit={submitMcq} className="cb-folio-marks">
                {question.options.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSelected(index);
                      setError('');
                    }}
                    className={`cb-folio-mark ${selected === index ? 'is-on' : ''}`}
                    style={{ '--d': `${0.06 + index * 0.05}s` } as CSSProperties}
                  >
                    <em>{selected === index ? '✓' : String.fromCharCode(65 + index)}</em>
                    <span>{option}</span>
                  </button>
                ))}
                {error ? <p className="cb-folio-error">{error}</p> : null}
                <button type="submit" className="cb-folio-btn" disabled={busy}>
                  {busy ? 'Saving...' : 'Submit'}
                </button>
              </form>
            </div>
          </article>
        )}
      </div>
    </CandidateShell>
  );
}
