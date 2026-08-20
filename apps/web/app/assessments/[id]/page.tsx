'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SKILL_ASSESSMENT_RULES, type SkillAssessmentSession } from '@careerbridge/shared';
import { answerSkillAssessment, getSkillAssessment } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { SkillMascot } from '@/components/SkillMascot';
import { Button } from '@/components/ui/Button';
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
      setError('Choose one answer to continue.');
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
        <section className="cb-arena">
          <span className="cb-arena-scan" />
          <div className="cb-arena-body">
            <div className="cb-arena-copy cb-arena-rise">
              <Link href="/assessments" className="cb-arena-kicker hover:underline">
                ← Skill check
              </Link>
              <h1>One question at a time</h1>
              <p>Tick one option, submit, then next. 3 objective questions, then 3 on camera.</p>
              <div className="mt-3">
                <Button type="button" size="md" block={false} className="cb-studio-btn" onClick={() => setAccepted(true)}>
                  Start question 1
                </Button>
              </div>
            </div>
            <div className="cb-arena-art">
              <div className="cb-arena-token">
                <i className="cb-arena-spinring" />
                <SkillMascot pose="guide" className="cb-arena-float" alt="Skill guide" />
              </div>
            </div>
          </div>
          <SkillProgress total={session.totalQuestions} current={0} />
        </section>
        <ol className="cb-check-list cb-arena-rise" style={{ animationDelay: '120ms' }}>
          {SKILL_ASSESSMENT_RULES.map((item, index) => (
            <li key={item} className="cb-check-row cb-rule-row text-xs text-primary" style={{ animationDelay: `${160 + index * 40}ms` }}>
              <span className="cb-rule-dot">{index + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </CandidateShell>
    );
  }

  const question = shown;
  const kind = question.kind;
  const last = question.index + 1 >= session.totalQuestions;
  const busy = loading || leaving;

  if (saved) {
    return (
      <CandidateShell studio scene="ok">
        <div className="cb-ok">
          <div className="cb-ok-card">
            <span className="cb-ok-tick" aria-hidden>
              <svg viewBox="0 0 24 24">
                <path d="M5 13.2 9.4 17.5 19 7.5" />
              </svg>
            </span>
            <h2>Question submitted successfully!</h2>
            <p className="cb-ok-meta">
              QUESTION {String(question.index + 1).padStart(2, '0')} OF {String(session.totalQuestions).padStart(2, '0')}:{' '}
              <b>{question.skill}</b>
            </p>
            <button type="button" className="cb-ok-btn" disabled={leaving} onClick={() => void goNext()}>
              {leaving ? 'Opening...' : last ? 'See result' : 'Next question'}
            </button>
          </div>
        </div>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell studio scene={kind === 'SPOKEN' ? 'cam' : 'type'}>
      <section className={`cb-arena ${kind === 'SPOKEN' ? 'is-compact' : ''}`}>
        <span className="cb-arena-scan" />
        <div className="cb-arena-body">
          <div className="cb-arena-copy">
            <Link href="/assessments" className="cb-arena-kicker hover:underline">
              ← Skill studio
            </Link>
            <h1>
              Question {question.index + 1}
              <em>of {session.totalQuestions}</em>
            </h1>
            <p>
              {question.skill} · {kind === 'SPOKEN' ? 'Look at the camera and speak' : 'Tick one option, then submit'}
            </p>
          </div>
          {kind === 'SPOKEN' ? null : (
            <div className="cb-arena-art hidden sm:grid">
              <SkillMascot pose="idea" className="cb-arena-idea" alt="" />
              <div className="cb-arena-token">
                <i className="cb-arena-spinring" />
                <SkillMascot pose="guide" className="cb-arena-float" alt="" />
              </div>
            </div>
          )}
        </div>
        <SkillProgress total={session.totalQuestions} current={question.index} justTicked={justTicked} />
      </section>
      <article key={question.index} className={`cb-q-stage cb-check-sheet p-3 sm:p-4 ${kind === 'SPOKEN' ? 'is-speak' : ''} ${leaving ? 'is-exit' : ''}`}>
        <span className="cb-q-no" aria-hidden>
          {String(question.index + 1).padStart(2, '0')}
        </span>
        {kind === 'SPOKEN' ? (
          <SkillSpokenAnswer
            key={question.index}
            prompt={question.prompt}
            skill={question.skill}
            value={typedText}
            onChange={setTypedText}
            error={error}
            loading={busy}
            onSubmit={(payload) => void send(payload)}
          />
        ) : (
          <>
            <p className="cb-check-kicker">Tick one · then submit</p>
            <h2 className="mt-1 text-base font-extrabold leading-snug text-primary">{question.prompt}</h2>
            <p className="mt-1 text-[11px] font-semibold text-muted">Choose an option and submit. Next question opens after it is saved.</p>
            <form onSubmit={submitMcq} className="mt-2 space-y-2">
              {question.options.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSelected(index);
                    setError('');
                  }}
                  className={`cb-pick ${selected === index ? 'is-on' : ''}`}
                >
                  <em>{selected === index ? '✓' : String.fromCharCode(65 + index)}</em>
                  <span>{option}</span>
                </button>
              ))}
              {error ? <p className="text-xs text-error">{error}</p> : null}
              <Button type="submit" size="md" block={false} className="cb-studio-btn" loading={busy} loadingLabel="Saving...">
                Submit
              </Button>
            </form>
          </>
        )}
      </article>
    </CandidateShell>
  );
}
