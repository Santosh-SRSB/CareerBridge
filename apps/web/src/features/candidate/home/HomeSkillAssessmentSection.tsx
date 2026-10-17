'use client';

import { useRouter } from 'next/navigation';
import { SkillMascot } from '@/components/SkillMascot';

export function HomeSkillAssessmentSection() {
  const router = useRouter();

  return (
    <section className="cb-home-skill-hero" aria-labelledby="home-skill-title">
      <div className="cb-home-skill-hero__copy">
        <p className="cb-home-skill-hero__kicker">Skill assessment</p>
        <h2 id="home-skill-title" className="cb-home-skill-hero__title">
          A strong resume opens the door.
          <span className="cb-home-skill-hero__break">
            A{' '}
            <em className="cb-home-skill-hero__mark">proven skill check</em>{' '}
            helps you walk through it.
          </span>
        </h2>
        <p className="cb-home-skill-hero__lead">
          Answer 3 quick typed questions, then record 3 short responses. You get a score only — no
          clip is stored.
        </p>
        <div className="cb-home-skill-hero__actions">
          <button
            type="button"
            className="cb-home-btn cb-home-btn--skill"
            onClick={() => router.push('/assessments')}
          >
            Start skill check
          </button>
          <button
            type="button"
            className="cb-home-btn cb-home-btn--outline"
            onClick={() => router.push('/assessments')}
          >
            View history
          </button>
        </div>
      </div>

      <div className="cb-home-skill-card" aria-hidden="true">
        <div className="cb-home-skill-card__sheet">
          <p className="cb-home-skill-card__label">6 questions</p>
          <ul className="cb-home-skill-card__list">
            <li className="is-done">
              <span /> Typed
            </li>
            <li className="is-done">
              <span /> Typed
            </li>
            <li className="is-done">
              <span /> Typed
            </li>
            <li className="is-active">
              <span /> Record
            </li>
            <li>
              <span /> Record
            </li>
            <li>
              <span /> Record
            </li>
          </ul>
          <div className="cb-home-skill-card__mic" />
        </div>
      </div>

      <aside className="cb-home-skill-hero__aside" aria-hidden="true">
        <SkillMascot pose="coach" className="cb-home-skill-hero__mascot" alt="" />
      </aside>
    </section>
  );
}
