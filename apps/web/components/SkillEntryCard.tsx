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
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-teal">Skill studio</span>
            <span className="mt-0.5 block text-xs font-extrabold">6 Passport questions</span>
            <span className="mt-0.5 block text-[11px] text-white/70">3 objective · 3 on camera</span>
          </span>
        </Link>
      </HoverTilt>
    );
  }

  return (
    <HoverTilt className={`w-full ${className}`}>
      <Link href="/assessments" className="cb-skill-tile">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-teal">Skill studio</p>
        <p className="mt-2 font-extrabold">Prove skills on camera</p>
        <p className="mt-1 text-xs text-white/70">3 objective ticks, then 3 recorded from your Passport resume.</p>
        <SkillMascot pose="coach" className="cb-skill-tile-mascot" alt="" />
      </Link>
    </HoverTilt>
  );
}

export function SkillStudioLoader({ label = 'Opening your skill studio...' }: { label?: string }) {
  return (
    <section className="cb-arena cb-arena-load">
      <span className="cb-arena-scan" />
      <div className="cb-arena-token">
        <i className="cb-arena-spinring" />
        <SkillMascot pose="coach" className="cb-arena-float" alt="" />
      </div>
      <p className="relative z-10 mt-2 text-xs font-semibold text-white/80">{label}</p>
    </section>
  );
}
