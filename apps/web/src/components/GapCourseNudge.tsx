'use client';

import Link from 'next/link';
import { formatGapLabel } from '@/lib/career-gap';

type Props = {
  gapMonths?: number | null;
};

export function GapCourseNudge({ gapMonths }: Props) {
  const months = Math.max(0, Math.round(gapMonths || 0));
  if (months < 1) return null;

  const gapText = formatGapLabel(months);

  return (
    <Link href="/courses" className="cb-gap-course-nudge" aria-label={`Career gap ${gapText}. See course suggestions to close your skill gaps.`}>
      <span className="cb-gap-course-nudge__pulse" aria-hidden />
      <div className="cb-gap-course-nudge__copy">
        <p className="cb-gap-course-nudge__kicker">Skill gap spotted</p>
        <p className="cb-gap-course-nudge__line">
          <strong>Gap {gapText}</strong>
          <span className="cb-gap-course-nudge__sep">·</span>
          our course suggestions can help
          <span className="cb-gap-course-nudge__sep">·</span>
          <em>open on Udemy</em>
        </p>
      </div>
      <span className="cb-gap-course-nudge__arrow" aria-hidden>
        <svg viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M2 12h38M32 4l12 8-12 8"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}
