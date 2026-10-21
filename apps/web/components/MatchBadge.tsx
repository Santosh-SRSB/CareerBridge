import { matchLabel } from '@/lib/match';

export function MatchBadge({ score }: { score: number }) {
  const label = matchLabel(score);
  const tone =
    score >= 80
      ? 'bg-[#6366f1] text-[#10137c]'
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
