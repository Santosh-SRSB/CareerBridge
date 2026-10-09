export function ScoreRing({
  value,
  size = 92,
  label = 'Score',
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const safe = Math.min(100, Math.max(0, value));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;
  const stroke = safe >= 70 ? 'var(--teal)' : safe >= 40 ? '#ca8a04' : '#b42318';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          style={{ stroke: 'color-mix(in srgb, var(--navy) 12%, transparent)' }}
          strokeWidth="8"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          style={{ stroke }}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-extrabold leading-none text-primary">{safe}</span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">{label}</span>
      </div>
    </div>
  );
}
