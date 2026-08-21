import { matchLabel } from '@/lib/match';

export function MatchBadge({ score }: { score: number }) {
  const label = matchLabel(score);
  const tone =
    score >= 80
      ? 'bg-[#14b8a6] text-[#0a2e2c]'
      : score >= 60
        ? 'bg-[#d8eef0] text-primary'
        : score >= 40
          ? 'bg-primary-soft text-muted'
          : 'bg-accent-soft text-error';

  return (
    <span className={`inline-flex rounded-pill px-3 py-1 text-xs font-bold ${tone}`}>
      ★ {label}
    </span>
  );
}
