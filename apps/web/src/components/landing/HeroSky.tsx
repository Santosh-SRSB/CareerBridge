function PlaneMark({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 140 72" className="paper-rocket-svg">
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#f4f7f5" />
          <stop offset="100%" stopColor="#d5e4df" />
        </linearGradient>
        <linearGradient id={`${id}-wing`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#eef6f3" />
          <stop offset="100%" stopColor="#b7cec7" />
        </linearGradient>
        <linearGradient id={`${id}-belly`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7faf8" />
          <stop offset="100%" stopColor="#c5d6d1" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5d76e" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1.5" dy="4" stdDeviation="2.2" floodColor="#062120" floodOpacity="0.28" />
        </filter>
      </defs>
      <g filter={`url(#${id}-soft)`}>
        <path d="M18 40 L128 28 L62 46 Z" fill={`url(#${id}-belly)`} />
        <path d="M18 40 L128 28 L54 34 Z" fill={`url(#${id}-top)`} />
        <path d="M54 34 L128 28 L72 18 L42 30 Z" fill={`url(#${id}-wing)`} />
        <path d="M54 34 L72 18 L48 22 Z" fill="#e8f0ed" />
        <path d="M54 34 L62 46 L38 50 L42 38 Z" fill={`url(#${id}-gold)`} opacity="0.92" />
        <path d="M42 38 L38 50 L28 44 Z" fill="#0a2e2c" opacity="0.18" />
        <path d="M18 40 L128 28" fill="none" stroke="#0a2e2c" strokeWidth="0.7" strokeOpacity="0.22" />
        <path d="M54 34 L128 28" fill="none" stroke="#ffffff" strokeWidth="0.9" strokeOpacity="0.7" />
        <path d="M118 27.2 L128 28 L119 30.4 Z" fill="#fff" opacity="0.85" />
      </g>
    </svg>
  );
}

export function HeroSky() {
  return (
    <div className="hero-sky" aria-hidden="true">
      <svg className="hero-zigs" viewBox="0 0 1200 640" preserveAspectRatio="none">
        <path className="zig zig-a" d="M-40 90 L80 40 L200 140 L320 50 L440 160 L560 70 L700 150 L820 55 L960 145 L1100 60 L1240 130" />
        <path className="zig zig-b" d="M1240 220 L1100 280 L980 180 L840 300 L700 190 L560 310 L420 200 L280 290 L140 170 L-40 260" />
        <path className="zig zig-c" d="M-20 380 L90 320 L210 430 L340 310 L470 440 L600 330 L740 450 L870 340 L1010 430 L1160 350 L1260 420" />
        <path className="zig zig-d" d="M1260 520 L1120 470 L980 560 L830 480 L690 570 L540 490 L390 555 L250 470 L110 540 L-40 490" />
        <path className="zig zig-e" d="M200 -20 L260 80 L180 160 L300 240 L220 320 L360 400 L280 480 L420 560 L340 660" />
        <path className="zig zig-f" d="M980 -10 L920 90 L1040 170 L940 260 L1080 340 L980 430 L1120 510 L1020 600" />
      </svg>

      <span className="paper-scrap scrap-1" />
      <span className="paper-scrap scrap-2" />
      <span className="paper-scrap scrap-3" />
      <span className="paper-scrap scrap-4" />

      <div className="paper-rocket paper-rocket-main">
        <span className="paper-rocket-wake" />
        <PlaneMark id="planeA" />
      </div>
      <div className="paper-rocket paper-rocket-slow">
        <PlaneMark id="planeB" />
      </div>
    </div>
  );
}
