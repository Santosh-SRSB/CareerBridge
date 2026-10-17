import { matchLabel } from '@/lib/match';

export function MatchBadge({ score }: { score: number }) {
  const label = matchLabel(score);
  const tone =
    score >= 80
      ? 'bg-[#1ec8c0] text-[#0c3340]'
      : score >= 60
        ? 'bg-[#eefbfb] text-primary'
        : score >= 40
          ? 'bg-primary-soft text-muted'
          : 'bg-accent-soft text-error';

  return (
    <span className={`inline-flex rounded-pill px-3 py-1 text-xs font-bold ${tone}`}>
      ★ {label}
    </span>
  );
}
