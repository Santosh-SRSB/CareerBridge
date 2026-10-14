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
  photoUrl?: string | null;
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
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(' ');
}

/** Normalize long catalog labels into short chip text. */
function shortSkill(skill: string) {
  const raw = skill.trim();
  if (!raw) return '';
  const paren = raw.match(/\(([^)]+)\)/);
  if (paren?.[1]) {
    const first = paren[1].split(/[,|/]/)[0]?.trim();
    if (first) return first.slice(0, 28);
  }
  return raw
    .replace(/^Frontend:\s*/i, '')
    .replace(/^Backend:\s*/i, '')
    .replace(/^DevOps(?:\s*&\s*CI\/CD)?:\s*/i, '')
    .replace(/^Infrastructure:\s*/i, '')
    .replace(/^Tools?:\s*/i, '')
    .replace(/^Programming:\s*/i, '')
    .replace(/^Web:\s*/i, '')
    .slice(0, 28);
}

function uniqueSkills(skills: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const skill of skills) {
    const label = shortSkill(skill);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function MatchedCandidateCard({
  rank,
  name,
  city,
  photoUrl,
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
  const allSkills = uniqueSkills(skills);
  const topSkills = allSkills.slice(0, 4);
  const moreSkills = Math.max(0, allSkills.length - topSkills.length);
  const profileHref =
    href ||
    (candidateId
      ? `/employer/candidates/${candidateId}${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`
      : null);

  return (
    <article className="ev-card ev-mcc">
      <header className="ev-mcc__head">
        <EvAvatar name={name} photoUrl={photoUrl} size="lg" />
        <div className="ev-mcc__who">
          <h3>
            <span className="ev-mcc__name">{displayName(name)}</span>
            <span className="ev-tag">#{rank}</span>
          </h3>
          <span className="ev-sub">{location}</span>
        </div>
        <span
          className="ev-mcc__score"
          aria-label={`${PROFILE_MATCH_LABEL} ${Math.round(totalScore)} out of 100`}
        >
          <EvPill tone={matchPillTone(info.color)}>Match {Math.round(totalScore)}/100</EvPill>
        </span>
      </header>

      <div className="ev-mcc__badges">
        {badge === 'matched' ? (
          <EvPill>Matched</EvPill>
        ) : badge === 'applied' ? (
          <EvPill tone="blue">Applied</EvPill>
        ) : (
          badge
        )}
        <EvPill tone={matchPillTone(info.color)}>{info.label}</EvPill>
      </div>

      <div className="ev-mcc__metrics">
        <div>
          <small>Skills fit</small>
          <b>{Math.round(skillsScore)}/40</b>
        </div>
        <div>
          <small>Experience fit</small>
          <b>{Math.round(experienceScore)}/20</b>
        </div>
      </div>

      <div className="ev-mcc__body">
        {topSkills.length > 0 ? (
          <div className="ev-chips" aria-label="Skills">
            {topSkills.map((skill) => (
              <span key={skill} className="ev-chip">
                {skill}
              </span>
            ))}
            {moreSkills > 0 ? <span className="ev-chip">+{moreSkills}</span> : null}
          </div>
        ) : (
          <p className="ev-sub ev-mcc__empty">No skills listed</p>
        )}

        {reasons[0] ? (
          <p className="ev-hint ev-mcc__fit">
            <b>Fit:</b> {reasons[0]}
            {reasons[1] ? ` · ${reasons[1]}` : ''}
          </p>
        ) : null}
        {gaps.length > 0 ? (
          <p className="ev-hint ev-mcc__gaps">
            <b>Gaps:</b> {gaps.slice(0, 2).join(', ')}
          </p>
        ) : null}
      </div>

      {profileHref ? (
        <Link href={profileHref} className="ev-btn ev-btn--ghost ev-mcc__cta">
          Open profile
        </Link>
      ) : null}
    </article>
  );
}
