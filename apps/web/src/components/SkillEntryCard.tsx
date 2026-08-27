'use client';

import Link from 'next/link';
import { HoverTilt } from '@/components/HoverTilt';
import { SkillMascot } from '@/components/SkillMascot';

export function SkillEntryCard({
  variant = 'tile',
  className = '',
}: {
  variant?: 'tile' | 'teaser';
  className?: string;
}) {
  if (variant === 'teaser') {
    return (
      <HoverTilt className={`w-full ${className}`}>
        <Link href="/assessments" className="cb-skill-teaser">
          <SkillMascot pose="guide" className="cb-skill-teaser-mascot" alt="" />
          <span className="min-w-0">
            <span className="cb-skill-tile-kicker">Skill check</span>
            <span className="cb-skill-tile-title">6 Passport questions</span>
            <span className="cb-skill-tile-note">Tick 3, then record 3</span>
          </span>
        </Link>
      </HoverTilt>
    );
  }

  return (
    <HoverTilt className={`w-full ${className}`}>
      <Link href="/assessments" className="cb-skill-tile">
        <p className="cb-skill-tile-kicker">Skill check</p>
        <p className="cb-skill-tile-title">Six Passport questions</p>
        <p className="cb-skill-tile-note">Tick 3, then record 3. Score only — no clip stored.</p>
        <SkillMascot pose="coach" className="cb-skill-tile-mascot" alt="" />
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
