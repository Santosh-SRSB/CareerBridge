'use client';

import Link from 'next/link';
import { HoverTilt } from '@/components/HoverTilt';
import { ScoreRing } from '@/components/ScoreRing';
import { SkillMascot } from '@/components/SkillMascot';

export function SkillEntryCard({
  variant = 'tile',
  className = '',
  score = null,
}: {
  variant?: 'tile' | 'teaser';
  className?: string;
  score?: number | null;
}) {
  if (variant === 'teaser') {
    return (
      <HoverTilt className={`w-full ${className}`}>
        <Link href="/assessments" className="cb-skill-teaser">
          <SkillMascot pose="guide" className="cb-skill-teaser-mascot" alt="" />
          <span className="min-w-0">
            <span className="cb-skill-tile-kicker">Skill check</span>
            <span className="cb-skill-tile-title">
              {score != null ? `Score ${score}` : '6 Passport questions'}
            </span>
            <span className="cb-skill-tile-note">Tick 3, then record 3</span>
          </span>
        </Link>
      </HoverTilt>
    );
  }

  return (
    <HoverTilt className={`w-full ${className}`}>
      <Link href="/assessments" className="cb-lift-card block p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-teal">Skill assessment</p>
        <div className="mt-3 flex items-center gap-3">
          <ScoreRing value={score ?? 0} size={64} label="Score" />
          <div className="min-w-0">
            <p className="font-bold text-primary">
              {score != null ? 'Retake skill check' : 'Six Passport questions'}
            </p>
            <p className="mt-1 text-sm text-muted">
              {score != null
                ? 'Your latest assessment score is on your Career Passport flow.'
                : 'Tick 3, then record 3. Score only — no clip stored.'}
            </p>
          </div>
        </div>
      </Link>
    </HoverTilt>
  );
}

export function SkillStudioLoader({ label = 'Opening your skill studio...' }: { label?: string }) {
  return (
    <section className="cb-quiz-load">
      <SkillMascot pose="coach" className="cb-quiz-load-mascot" alt="" />
      <p>{label}</p>
    </section>
  );
}
