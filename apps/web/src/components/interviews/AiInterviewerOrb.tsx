'use client';

import { useId } from 'react';
import './ai-interviewer-orb.css';

export function AiInterviewerOrb({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const brand = `${uid}-brand`;
  const light = `${uid}-light`;
  const deep = `${uid}-deep`;
  const face = `${uid}-face`;

  return (
    <span className={`ai-orb ${className}`} role="img" aria-label="AI interviewer">
      <span className="ai-orb__halo" aria-hidden />
      <svg className="ai-orb__svg" viewBox="0 0 120 120" aria-hidden>
        <defs>
          <radialGradient id={brand} cx="34%" cy="28%" r="80%">
            <stop offset="0" stopColor="#7b8cff" />
            <stop offset="0.45" stopColor="#1a1fc4" />
            <stop offset="1" stopColor="#10137c" />
          </radialGradient>
          <radialGradient id={light} cx="34%" cy="28%" r="80%">
            <stop offset="0" stopColor="#c9d3ff" />
            <stop offset="0.5" stopColor="#5c74f2" />
            <stop offset="1" stopColor="#2a35d6" />
          </radialGradient>
          <radialGradient id={deep} cx="34%" cy="28%" r="80%">
            <stop offset="0" stopColor="#4a5be8" />
            <stop offset="0.5" stopColor="#10137c" />
            <stop offset="1" stopColor="#080a4a" />
          </radialGradient>
          <radialGradient id={face} cx="50%" cy="40%" r="65%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#eef1ff" />
          </radialGradient>
        </defs>

        <g className="ai-orb__body">
          <circle cx="60" cy="60" r="46" fill={`url(#${brand})`} />
          <circle className="ai-orb__tint ai-orb__tint--light" cx="60" cy="60" r="46" fill={`url(#${light})`} />
          <circle className="ai-orb__tint ai-orb__tint--deep" cx="60" cy="60" r="46" fill={`url(#${deep})`} />

          <g className="ai-orb__face">
            <circle cx="60" cy="60" r="37" fill={`url(#${face})`} />
            <g className="ai-orb__eyes">
              <rect className="ai-orb__eye" x="47" y="51" width="7" height="17" rx="3.5" />
              <rect className="ai-orb__eye" x="66" y="51" width="7" height="17" rx="3.5" />
            </g>
            <g className="ai-orb__dots">
              <circle cx="53" cy="60" r="3.6" />
              <circle cx="67" cy="60" r="3.6" />
            </g>
            <g className="ai-orb__alert">
              <rect x="56.5" y="40" width="7" height="26" rx="3.5" />
              <circle cx="60" cy="76" r="4.4" />
            </g>
            <g className="ai-orb__think">
              <circle className="ai-orb__think-arc" cx="60" cy="60" r="13" />
            </g>
          </g>

          <path className="ai-orb__gloss" d="M60 14 a46 46 0 0 1 30 11" />
        </g>
      </svg>
    </span>
  );
}
