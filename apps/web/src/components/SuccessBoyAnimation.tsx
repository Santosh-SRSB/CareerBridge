'use client';

import { OB } from '@/components/OnboardingFrame';

/** Cheerful success character — CSS/SVG animation matching onboarding palette. */
export function SuccessBoyAnimation({ className = '' }: { className?: string }) {
  return (
    <div className={`cb-success-boy ${className}`} aria-hidden>
      <div className="cb-success-boy__glow" />
      <svg className="cb-success-boy__svg" viewBox="0 0 160 160" fill="none">
        {/* confetti */}
        <circle className="cb-success-boy__dot cb-success-boy__dot--a" cx="28" cy="42" r="3.5" fill={OB.gold} />
        <circle className="cb-success-boy__dot cb-success-boy__dot--b" cx="132" cy="38" r="3" fill={OB.moss} />
        <circle className="cb-success-boy__dot cb-success-boy__dot--c" cx="24" cy="98" r="2.5" fill={OB.clay} />
        <circle className="cb-success-boy__dot cb-success-boy__dot--d" cx="136" cy="110" r="3" fill={OB.gold} />
        <rect className="cb-success-boy__dash cb-success-boy__dash--a" x="18" y="68" width="12" height="2.5" rx="1" fill="#9CA392" />
        <rect className="cb-success-boy__dash cb-success-boy__dash--b" x="130" y="72" width="12" height="2.5" rx="1" fill="#9CA392" />

        {/* soft ring */}
        <circle cx="80" cy="80" r="52" fill="#EEF2E9" />
        <circle className="cb-success-boy__ring" cx="80" cy="80" r="44" stroke={OB.moss} strokeWidth="3" fill="none" />

        {/* boy */}
        <g className="cb-success-boy__figure">
          {/* body */}
          <path
            d="M58 118c4-18 14-28 22-28s18 10 22 28"
            fill={OB.moss}
            opacity="0.92"
          />
          {/* head */}
          <circle cx="80" cy="62" r="16" fill="#F5D0AE" />
          {/* hair */}
          <path
            d="M66 58c2-12 10-16 14-16 5 0 12 4 14 16-3-4-7-6-14-6s-11 2-14 6z"
            fill={OB.ink}
          />
          {/* smile */}
          <path
            d="M73 66c2.2 3 5.5 4.5 7 4.5s4.8-1.5 7-4.5"
            stroke={OB.ink}
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          {/* eyes */}
          <circle cx="74" cy="60" r="1.6" fill={OB.ink} />
          <circle cx="86" cy="60" r="1.6" fill={OB.ink} />
          {/* raised arms / celebrating */}
          <path
            className="cb-success-boy__arm-l"
            d="M62 92c-10-8-16-4-18 2"
            stroke={OB.moss}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            className="cb-success-boy__arm-r"
            d="M98 92c10-8 16-4 18 2"
            stroke={OB.moss}
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>

        {/* floating check badge */}
        <g className="cb-success-boy__badge">
          <circle cx="118" cy="52" r="14" fill={OB.moss} />
          <path
            d="M111 52.5l4 4 8-8"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
}
