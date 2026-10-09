'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { PROFILE_MATCH_LABEL, atsMatchBandInfo } from '@careerbridge/shared';
import { EvAvatar, EvPill } from '@/components/employer/ui';
import { matchPillTone } from '@/lib/employer-ui-status';

export type MatchedCandidateCardProps = {
  rank: number;
  name: string;
  city?: string | null;
  skills?: string[];
  totalScore: number;
  skillsScore: number;
  experienceScore: number;
  reasons?: string[];
  gaps?: string[];
  badge?: 'matched' | 'applied' | ReactNode;
  href?: string;
  jobId?: string;
  candidateId?: string | null;
};

function cleanLocation(city?: string | null) {
  if (!city?.trim()) return 'Location n/a';
  const parts = city
    .split(/[,|/·•]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (!unique.some((u) => u.toLowerCase() === key)) unique.push(part);
  }
  return unique.slice(0, 2).join(', ') || 'Location n/a';
}

function displayName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function shortSkill(skill: string) {
  return skill.replace(/^Frontend:\s*/i, '').trim();
}

export function MatchedCandidateCard({
  rank,
  name,
  city,
  skills = [],
  totalScore,
  skillsScore,
  experienceScore,
  reasons = [],
  gaps = [],
  badge = 'matched',
  href,
  jobId,
  candidateId,
}: MatchedCandidateCardProps) {
  const info = atsMatchBandInfo(totalScore);
  const location = cleanLocation(city);
  const topSkills = skills.slice(0, 5).map(shortSkill);
  const moreSkills = Math.max(0, skills.length - 5);
  const profileHref =
    href ||
    (candidateId
      ? `/employer/candidates/${candidateId}${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`
      : null);

  return (
    <article className="ev-card ev-cand">
      <div className="ev-cand-hd">
        <EvAvatar name={name} size="lg" />
        <div>
          <h3>
            {displayName(name)} <span className="ev-tag">#{rank}</span>
          </h3>
          <span className="ev-sub">{location}</span>
        </div>
        <span aria-label={`${PROFILE_MATCH_LABEL} ${Math.round(totalScore)} out of 100`}>
          <EvPill tone={matchPillTone(info.color)}>Match {Math.round(totalScore)}/100</EvPill>
        </span>
      </div>

      <div className="ev-chips">
        {badge === 'matched' ? (
          <EvPill>Matched</EvPill>
        ) : badge === 'applied' ? (
          <EvPill tone="blue">Applied</EvPill>
        ) : (
          badge
        )}
        <EvPill tone={matchPillTone(info.color)}>{info.label}</EvPill>
      </div>

      <div className="ev-kv">
        <div>
          <small>SKILLS FIT</small>
          <b>{Math.round(skillsScore)}/40</b>
        </div>
        <div>
          <small>EXPERIENCE FIT</small>
          <b>{Math.round(experienceScore)}/20</b>
        </div>
      </div>

      {topSkills.length > 0 ? (
        <div className="ev-chips">
          {topSkills.map((skill) => (
            <span key={skill} className="ev-chip">
              {skill}
            </span>
          ))}
          {moreSkills > 0 ? <span className="ev-chip">+{moreSkills}</span> : null}
        </div>
      ) : null}

      {reasons[0] ? (
        <p className="ev-hint">
          <b>Fit:</b> {reasons[0]}
          {reasons[1] ? ` · ${reasons[1]}` : ''}
        </p>
      ) : null}
      {gaps.length > 0 ? (
        <p className="ev-hint">
          <b>Gaps:</b> {gaps.slice(0, 3).join(', ')}
        </p>
      ) : null}

      {profileHref ? (
        <Link href={profileHref} className="ev-btn ev-btn--ghost">
          Open profile
        </Link>
      ) : null}
    </article>
  );
}
