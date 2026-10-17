'use client';

/**
 * Neon ribbon waveform — only animates when voice is present.
 * Silent = calm flat ribbon (no “fumble”).
 */
export function NeonVoiceWave({
  levels,
  voiceActive,
  className = '',
}: {
  levels: number[];
  voiceActive: boolean;
  className?: string;
}) {
  const width = 640;
  const height = 160;
  const mid = height / 2;
  const n = Math.max(8, levels.length);

  const points = Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * width;
    const raw = levels[i] ?? 10;
    // Keep a gentle idle undulation when silent; spike only with voice.
    const amp = voiceActive ? ((raw - 10) / 86) * 58 : 4 + Math.sin(i * 0.45) * 2;
    return { x, y: mid - amp };
  });

  const buildPath = (offsetY: number, scale = 1) => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${mid + offsetY}`;
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const y = mid + (p.y - mid) * scale + offsetY;
      if (i === 0) d = `M ${p.x} ${y}`;
      else {
        const prev = points[i - 1];
        const cpx = (prev.x + p.x) / 2;
        d += ` Q ${cpx} ${mid + (prev.y - mid) * scale + offsetY} ${p.x} ${y}`;
      }
    }
    // Mirror underside for a ribbon feel
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const p = points[i];
      const y = mid - (p.y - mid) * scale * 0.85 + offsetY;
      d += ` L ${p.x} ${y}`;
    }
    return `${d} Z`;
  };

  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cb-neon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="28%" stopColor="#a855f7" />
            <stop offset="55%" stopColor="#f97316" />
            <stop offset="78%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <filter id="cb-neon-glow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation={voiceActive ? 4 : 2} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={buildPath(0, 1.15)}
          fill="url(#cb-neon-grad)"
          opacity={voiceActive ? 0.35 : 0.18}
          filter="url(#cb-neon-glow)"
        />
        <path
          d={buildPath(0, 0.9)}
          fill="url(#cb-neon-grad)"
          opacity={voiceActive ? 0.7 : 0.35}
          filter="url(#cb-neon-glow)"
        />
        <path
          d={buildPath(0, 0.45)}
          fill="#ffffff"
          opacity={voiceActive ? 0.85 : 0.4}
        />
      </svg>
      {!voiceActive ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          Waiting for your voice…
        </p>
      ) : null}
    </div>
  );
}
