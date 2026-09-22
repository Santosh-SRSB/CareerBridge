'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { atsMatchBandLabel } from '@careerbridge/shared';

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

function bandClass(score: number) {
  const label = atsMatchBandLabel(score).toLowerCase();
  if (label.includes('excellent')) return 'excellent';
  if (label.includes('strong')) return 'strong';
  if (label.includes('good')) return 'good';
  if (label.includes('potential')) return 'potential';
  return 'low';
}

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
  const band = bandClass(totalScore);
  const bandLabel = atsMatchBandLabel(totalScore).replace(' Match', '');
  const location = cleanLocation(city);
  const topSkills = skills.slice(0, 5).map(shortSkill);
  const moreSkills = Math.max(0, skills.length - 5);
  const profileHref =
    href ||
    (candidateId
      ? `/employer/candidates/${candidateId}${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`
      : null);

  return (
    <article className={`ep-talent ep-talent--${band}`}>
      <aside className="ep-talent__score" aria-label={`ATS score ${totalScore}`}>
        <span className="ep-talent__rank">#{rank}</span>
        <strong className="ep-talent__score-num">{Math.round(totalScore)}</strong>
        <em className="ep-talent__score-label">/100</em>
      </aside>

      <div className="ep-talent__body">
        <div className="ep-talent__row">
          <header className="ep-talent__head">
            <div className="ep-talent__title">
              <h3>{displayName(name)}</h3>
              {badge === 'matched' ? (
                <span className="ep-talent__pill">Matched</span>
              ) : badge === 'applied' ? (
                <span className="ep-talent__pill ep-talent__pill--dark">Applied</span>
              ) : (
                badge
              )}
              <span className={`ep-talent__band ep-talent__band--${band}`}>{bandLabel}</span>
            </div>
            <p className="ep-talent__loc">{location}</p>
          </header>
          {profileHref ? (
            <Link href={profileHref} className="ep-talent__cta">
              Open profile
            </Link>
          ) : null}
        </div>

        <div className="ep-talent__metrics">
          <div className="ep-talent__metric">
            <strong>
              {Math.round(skillsScore)}
              <em>/40</em>
            </strong>
            <span>Skills fit</span>
          </div>
          <div className="ep-talent__metric">
            <strong>
              {Math.round(experienceScore)}
              <em>/30</em>
            </strong>
            <span>Exp fit</span>
          </div>
        </div>

        {topSkills.length > 0 ? (
          <ul className="ep-talent__skills">
            {topSkills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
            {moreSkills > 0 ? <li className="is-more">+{moreSkills}</li> : null}
          </ul>
        ) : null}

        {reasons.length > 0 || gaps.length > 0 ? (
          <div className="ep-talent__notes">
            {reasons[0] ? (
              <p className="ep-talent__note ep-talent__note--ok">
                <span>Fit</span> {reasons[0]}
                {reasons[1] ? ` · ${reasons[1]}` : ''}
              </p>
            ) : null}
            {gaps.length > 0 ? (
              <p className="ep-talent__note ep-talent__note--gap">
                <span>Gaps</span> {gaps.slice(0, 3).join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
