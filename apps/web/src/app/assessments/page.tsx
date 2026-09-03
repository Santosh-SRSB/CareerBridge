'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  SKILL_ASSESSMENT_PACK_PRICE_INR,
  SKILL_ASSESSMENT_RECORDED_COUNT,
  SKILL_ASSESSMENT_TYPED_COUNT,
  type SkillAssessmentAccess,
  type SkillAssessmentSession,
} from '@careerbridge/shared';
import {
  getSkillAssessmentAccess,
  listSkillAssessments,
  startSkillAssessment,
  unlockSkillAssessments,
} from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { SkillMascot } from '@/components/SkillMascot';
import { SkillStudioLoader } from '@/components/SkillEntryCard';

export default function AssessmentsPage() {
  const router = useRouter();
  const [history, setHistory] = useState<SkillAssessmentSession[]>([]);
  const [access, setAccess] = useState<SkillAssessmentAccess | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listSkillAssessments(), getSkillAssessmentAccess()])
      .then(([items, nextAccess]) => {
        setHistory(items);
        setAccess(nextAccess);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setReady(true));
  }, [router]);

  async function start() {
    setLoading(true);
    setError('');
    try {
      const open = history.find((item) => item.status === 'IN_PROGRESS');
      if (open) {
        router.push(`/assessments/${open.id}`);
        return;
      }
      const session = await startSkillAssessment();
      router.push(`/assessments/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not start the skill assessment.');
    } finally {
      setLoading(false);
    }
  }

  async function unlock() {
    setLoading(true);
    setError('');
    try {
      setAccess(await unlockSkillAssessments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment could not be completed.');
    } finally {
      setLoading(false);
    }
  }

  const inProgress = history.some((item) => item.status === 'IN_PROGRESS');
  const needsPay = Boolean(access && !access.canStart && !inProgress);
  const needsPassport = /passport/i.test(error);

  if (!ready) {
    return (
      <CandidateShell studio scene="drop">
        <SkillStudioLoader />
      </CandidateShell>
    );
  }

  return (
    <CandidateShell studio scene="drop">
      <div className="cb-folio">
        <i className="cb-folio-tape a" />
        <i className="cb-folio-tape b" />
        <div className="cb-folio-stack">
          <i className="cb-folio-layer s3" />
          <i className="cb-folio-layer s2" />
          <section className="cb-folio-sheet">
            <span className="cb-folio-spine">PASSPORT CHECK</span>
            <div className="cb-folio-seal" aria-hidden>
              06
            </div>
            <p className="cb-folio-kicker">Built from your Career Passport</p>
            <h1>
              Tick three.
              <em>Then speak three.</em>
            </h1>
            <p className="cb-folio-lead">
              {SKILL_ASSESSMENT_TYPED_COUNT} objective ticks, then {SKILL_ASSESSMENT_RECORDED_COUNT} on camera. The clip is
              scored and discarded.
            </p>
            <ul className="cb-folio-chips">
              <li>
                <b>{SKILL_ASSESSMENT_TYPED_COUNT}</b> ticks
              </li>
              <li>
                <b>{SKILL_ASSESSMENT_RECORDED_COUNT}</b> camera
              </li>
              <li>
                <b>{access ? access.credits : '—'}</b> left
              </li>
            </ul>
            <ol className="cb-folio-steps">
              <li className={!needsPay && !inProgress ? 'is-now' : ''}>
                <span>01</span> Passport skills
              </li>
              <li className={inProgress ? 'is-now' : ''}>
                <span>02</span> Tick, then submit
              </li>
              <li>
                <span>03</span> Face + voice, 8–20s
              </li>
            </ol>
            {needsPay ? (
              <button type="button" className="cb-folio-btn" disabled={loading} onClick={() => void unlock()}>
                {loading ? 'Unlocking...' : `Unlock ${access?.packCredits || 3} · ₹${access?.packPriceInr || SKILL_ASSESSMENT_PACK_PRICE_INR}`}
              </button>
            ) : (
              <button type="button" className="cb-folio-btn" disabled={loading} onClick={() => void start()}>
                {loading ? 'Opening...' : inProgress ? 'Continue this check' : 'Start from my Passport'}
              </button>
            )}
            {error ? <p className="cb-folio-error">{error}</p> : null}
            {needsPassport ? (
              <Link href="/passport/personal" className="cb-folio-link">
                Complete Passport
              </Link>
            ) : null}
            <SkillMascot pose="idea" className="cb-folio-sticker" alt="" />
          </section>
        </div>

        <section className="cb-folio-past">
          <header>
            <h2>Filed checks</h2>
            <span>{history.length ? `${history.length} saved` : 'None yet'}</span>
          </header>
          {history.length ? (
            <div className="cb-folio-slips">
              {history.map((item, index) => {
                const score = item.score ?? 0;
                const done = item.status === 'COMPLETED' && item.score != null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`cb-folio-slip ${done ? 'is-done' : 'is-open'}`}
                    style={{ '--d': `${0.08 + index * 0.06}s`, '--r': `${index % 2 ? 1.2 : -1.1}deg` } as CSSProperties}
                    onClick={() =>
                      router.push(item.status === 'COMPLETED' ? `/assessments/${item.id}/result` : `/assessments/${item.id}`)
                    }
                  >
                    <small>{done ? 'Result' : 'Open'}</small>
                    <p>{item.skills.slice(0, 3).join(' · ') || 'Skill check'}</p>
                    <strong>{done ? score : '—'}</strong>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="cb-folio-empty">No checks filed yet. Start from your Passport resume.</p>
          )}
        </section>
      </div>
    </CandidateShell>
  );
}
