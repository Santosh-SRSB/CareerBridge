'use client';

import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/Button';
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
      <section className="cb-arena">
        <span className="cb-arena-scan" />
        <div className="cb-arena-body">
          <div className="cb-arena-copy cb-arena-rise">
            <p className="cb-free-tag">
              <span>Free</span> for candidate
            </p>
            <h1>
              From your Passport.
              <em className="cb-hero-accent">Get 6 questions.</em>
            </h1>
            <p>Built from your Career Passport resume: 3 objective ticks, then 3 on camera. We score the clip and keep the score only.</p>
            <div className="cb-arena-chips">
              <span className="cb-arena-chip is-teal">{SKILL_ASSESSMENT_TYPED_COUNT} objective</span>
              <span className="cb-arena-chip is-orange">{SKILL_ASSESSMENT_RECORDED_COUNT} recorded</span>
              <span className="cb-arena-chip is-gold">{access ? `${access.credits} left` : '…'}</span>
            </div>
          </div>
          <div className="cb-arena-art">
            <SkillMascot pose="idea" className="cb-arena-idea" alt="" />
            <div className="cb-arena-token">
              <i className="cb-arena-spinring" />
              <SkillMascot pose="coach" className="cb-arena-float" alt="Skill coach" />
            </div>
          </div>
        </div>
        <ol className="cb-flow">
          <li className={!needsPay && !inProgress ? 'is-now' : ''}>
            <em>01</em>
            <div>
              <b>Passport resume</b>
              <span>Skills on file</span>
            </div>
          </li>
          <li className={inProgress ? 'is-now' : ''}>
            <em>02</em>
            <div>
              <b>Tick 3</b>
              <span>Objective</span>
            </div>
          </li>
          <li>
            <em>03</em>
            <div>
              <b>Camera 3</b>
              <span>Face + voice</span>
            </div>
          </li>
        </ol>
        <div className="cb-arena-action">
          {needsPay ? (
            <Button type="button" size="md" variant="tertiary" block={false} className="cb-studio-btn" loading={loading} loadingLabel="Unlocking..." onClick={() => void unlock()}>
              Unlock {access?.packCredits || 3} · ₹{access?.packPriceInr || SKILL_ASSESSMENT_PACK_PRICE_INR}
            </Button>
          ) : inProgress ? (
            <Button type="button" size="md" block={false} className="cb-studio-btn" loading={loading} loadingLabel="Opening..." onClick={() => void start()}>
              Continue skill check
            </Button>
          ) : (
            <Button type="button" size="md" block={false} className="cb-studio-btn" loading={loading} loadingLabel="Building questions..." onClick={() => void start()}>
              Start from my Passport
            </Button>
          )}
          {error ? <p className="mt-2 text-xs text-[#ffb4a8]">{error}</p> : null}
          {needsPassport ? (
            <Link href="/passport/personal?flow=1" className="mt-2 inline-block text-xs font-bold text-[#1ec8c0] hover:underline">
              Complete Passport
            </Link>
          ) : null}
        </div>
      </section>

      <section className="cb-arena-rise" style={{ animationDelay: '180ms' }}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">Earlier checks</h2>
          <p className="text-[11px] font-semibold text-muted">{history.length ? `${history.length} saved` : 'None yet'}</p>
        </div>
        {history.length ? (
          <div className="cb-check-list">
            {history.map((item, index) => {
              const score = item.score ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="cb-check-row"
                  style={{ animationDelay: `${220 + index * 50}ms` }}
                  onClick={() =>
                    router.push(item.status === 'COMPLETED' ? `/assessments/${item.id}/result` : `/assessments/${item.id}`)
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-primary">
                      {item.skills.slice(0, 3).join(', ') || 'Skill check'}
                    </p>
                    <p className="text-[11px] text-muted">
                      {item.status === 'COMPLETED' ? 'Open result' : 'Continue'} · Resume {item.resumeScore}
                    </p>
                    {item.status === 'COMPLETED' && item.score != null ? (
                      <div className={`cb-check-meter mt-1 ${score < 70 ? 'is-mid' : ''}`}>
                        <i style={{ width: `${score}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-base font-extrabold text-primary">
                    {item.status === 'COMPLETED' && item.score != null ? score : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-1 text-xs text-muted">No skill checks yet. Start from your Passport resume.</p>
        )}
      </section>
    </CandidateShell>
  );
}
