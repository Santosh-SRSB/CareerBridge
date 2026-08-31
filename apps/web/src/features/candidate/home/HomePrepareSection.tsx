'use client';

import Link from 'next/link';
import { ScoreRing } from '@/components/ScoreRing';
import { SkillEntryCard } from '@/components/SkillEntryCard';

type Props = {
  resumeScore: number | null;
  interviewScore: number | null;
  hasResume: boolean;
  headlineSkill?: string;
};

export function HomePrepareSection({ resumeScore, interviewScore, hasResume, headlineSkill }: Props) {
  return (
    <section className="cb-home-section cb-home-section--prepare" aria-labelledby="home-prepare-title">
      <header className="cb-home-section__head">
        <div>
          <p className="cb-home-section__kicker">Prepare</p>
          <h2 id="home-prepare-title">Get interview ready</h2>
        </div>
        <Link href="/interviews" className="cb-home-section__link">
          View all
        </Link>
      </header>

      <div className="cb-home-prepare-grid">
        <Link href="/resume" className="cb-home-prepare-card">
          <p className="cb-home-prepare-card__label">Resume</p>
          <div className="cb-home-prepare-card__body">
            <ScoreRing value={resumeScore ?? 0} size={56} label="Score" />
            <div className="min-w-0">
              <p className="cb-home-prepare-card__title">
                {hasResume ? 'Improve your resume' : 'Create your first resume'}
              </p>
              <p className="cb-home-prepare-card__note">Built from your Career Passport.</p>
            </div>
          </div>
        </Link>

        <Link href="/interviews" className="cb-home-prepare-card">
          <p className="cb-home-prepare-card__label">Interview</p>
          <div className="cb-home-prepare-card__body">
            <ScoreRing value={interviewScore ?? 0} size={56} label="Score" />
            <div className="min-w-0">
              <p className="cb-home-prepare-card__title">Practice a mock interview</p>
              <p className="cb-home-prepare-card__note">
                {headlineSkill ? `Try questions around ${headlineSkill}.` : 'Get feedback you can act on.'}
              </p>
            </div>
          </div>
        </Link>

        <SkillEntryCard className="cb-home-prepare-skill" />
      </div>
    </section>
  );
}
