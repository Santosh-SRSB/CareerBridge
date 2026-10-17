import { PROFILE_MATCH_LABEL, atsMatchBandInfo } from '@careerbridge/shared';

const TONES = {
  green: 'bg-[#d1fae5] text-[#065f46]',
  blue: 'bg-[#dbeafe] text-[#1e3a8a]',
  amber: 'bg-[#fef3c7] text-[#78350f]',
  grey: 'bg-[#e5e7eb] text-[#374151]',
} as const;

export function MatchBadge({ score }: { score: number }) {
  const info = atsMatchBandInfo(score);
  return (
    <span
      className={`inline-flex rounded-pill px-3 py-1 text-xs font-bold ${TONES[info.color]}`}
      title={`${PROFILE_MATCH_LABEL}: ${Math.round(score)}%`}
      data-band={info.band.toLowerCase()}
    >
      {info.label}
    </span>
  );
}
