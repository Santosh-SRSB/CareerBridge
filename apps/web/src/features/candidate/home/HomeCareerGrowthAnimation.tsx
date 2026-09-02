'use client';

import { useEffect, useState } from 'react';

/** Steep exponential rise — flat early, sharp climb late */
const STAGES = [
  { id: 'passport', label: 'Passport', height: 6 },
  { id: 'resume', label: 'Resume', height: 10 },
  { id: 'skills', label: 'Skills', height: 18 },
  { id: 'interview', label: 'Interview', height: 32 },
  { id: 'course', label: 'Course', height: 55 },
  { id: 'job', label: 'Job', height: 96 },
] as const;

const STEP_MS = 1100;
const HOLD_JOB_MS = 1800;

function BoyFigure({ professional }: { professional: boolean }) {
  return (
    <svg className="cb-growth-boy__svg" viewBox="0 0 64 88" fill="none" aria-hidden="true">
      {professional ? (
        <g>
          <ellipse cx="32" cy="14" rx="16" ry="5" fill="#0a2e2c" />
          <path d="M16 14 L32 6 L48 14" fill="#062120" />
          <rect x="40" y="12" width="12" height="3" rx="1" fill="#eab308" />
        </g>
      ) : null}

      <circle cx="32" cy="22" r="11" fill="#f0c9a0" />
      <circle cx="28" cy="21" r="1.2" fill="#0a2e2c" />
      <circle cx="36" cy="21" r="1.2" fill="#0a2e2c" />
      <path d="M29 26 Q32 28 35 26" stroke="#0a2e2c" strokeWidth="1.2" strokeLinecap="round" />
      {!professional ? (
        <path d="M22 18 Q32 10 42 18 Q40 14 32 12 Q24 14 22 18Z" fill="#3b2a1e" />
      ) : (
        <path d="M22 16 Q32 11 42 16 Q38 13 32 12 Q26 13 22 16Z" fill="#2a1f18" />
      )}

      {professional ? (
        <>
          <path d="M20 34 L32 38 L44 34 L46 62 L18 62 Z" fill="#0a2e2c" />
          <path d="M32 38 L32 62" stroke="#eab308" strokeWidth="1.5" />
          <path d="M20 34 L32 42 L44 34" fill="none" stroke="#062120" strokeWidth="1.2" />
          <path d="M26 34 L32 40 L38 34" fill="#fff" />
          <rect x="22" y="62" width="9" height="18" rx="2" fill="#062120" />
          <rect x="33" y="62" width="9" height="18" rx="2" fill="#062120" />
          <path d="M18 40 Q10 28 16 22" stroke="#f0c9a0" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M46 40 Q54 28 48 22" stroke="#f0c9a0" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M20 34 L32 38 L44 34 L45 58 L19 58 Z" fill="#14b8a6" />
          <path d="M20 34 L14 42 L18 44 L22 36Z" fill="#0f766e" />
          <path d="M44 34 L50 42 L46 44 L42 36Z" fill="#0f766e" />
          <rect x="22" y="58" width="9" height="20" rx="2" fill="#1e3a5f" />
          <rect x="33" y="58" width="9" height="20" rx="2" fill="#1e3a5f" />
        </>
      )}

      <ellipse cx="26.5" cy="80" rx="6" ry="2.5" fill={professional ? '#0a2e2c' : '#334155'} />
      <ellipse cx="37.5" cy="80" rx="6" ry="2.5" fill={professional ? '#0a2e2c' : '#334155'} />
    </svg>
  );
}

/** Strong J-curve arc (more bend than a straight climb through tops) */
function buildCurvePath() {
  const pts = STAGES.map((s, i) => {
    const x = ((i + 0.5) / STAGES.length) * 100;
    const y = 100 - s.height;
    return { x, y };
  });

  const start = pts[0];
  const mid = pts[2];
  const late = pts[4];
  const end = pts[pts.length - 1];

  // Flat start → soft lift → sharp upward bend into Job
  return [
    `M ${start.x} ${start.y}`,
    `C ${start.x + 10} ${start.y}, ${mid.x - 4} ${mid.y + 6}, ${mid.x} ${mid.y}`,
    `C ${mid.x + 8} ${mid.y - 10}, ${late.x - 6} ${late.y + 18}, ${late.x} ${late.y}`,
    `C ${late.x + 6} ${late.y - 22}, ${end.x - 4} ${end.y + 8}, ${end.x} ${end.y}`,
  ].join(' ');
}

const CURVE_PATH = buildCurvePath();

export function HomeCareerGrowthAnimation() {
  const [stage, setStage] = useState(0);
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = (next: number) => {
      if (cancelled) return;
      setStage(next);
      setVisibleCount(next + 1);

      const delay = next === STAGES.length - 1 ? HOLD_JOB_MS : STEP_MS;
      timer = setTimeout(() => {
        if (next >= STAGES.length - 1) {
          setVisibleCount(0);
          timer = setTimeout(() => {
            if (!cancelled) tick(0);
          }, 420);
        } else {
          tick(next + 1);
        }
      }, delay);
    };

    timer = setTimeout(() => tick(0), 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const active = STAGES[Math.min(stage, STAGES.length - 1)];
  const professional = stage === STAGES.length - 1 && visibleCount === STAGES.length;
  const boyLeft = `${((stage + 0.5) / STAGES.length) * 100}%`;
  const boyBottom = `${active.height}%`;
  const curveProgress = stage / (STAGES.length - 1);

  return (
    <div className="cb-growth" aria-hidden="true">
      <div className="cb-growth__chart">
        <div className="cb-growth__plot">
          <svg className="cb-growth__curve" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cbGrowthArrow" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#eab308" />
                <stop offset="45%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
              <marker
                id="cbGrowthArrowHead"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill="#dc2626" />
              </marker>
            </defs>
            <path
              className="cb-growth__curve-line"
              d={CURVE_PATH}
              fill="none"
              stroke="url(#cbGrowthArrow)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd="url(#cbGrowthArrowHead)"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1 - curveProgress,
              }}
            />
          </svg>

          <div className="cb-growth__bars">
            {STAGES.map((s, i) => {
              const grown = i < visibleCount;
              const activeBar = i === stage;
              return (
                <div
                  key={s.id}
                  className={`cb-growth__col${activeBar ? ' is-active' : ''}${grown ? ' is-on' : ''}`}
                  style={{ ['--bar-h' as string]: `${s.height}%` }}
                >
                  <span className="cb-growth__bar-label">{s.label}</span>
                  <div className={`cb-growth__bar${grown ? ' is-grown' : ''}`} />
                </div>
              );
            })}
          </div>

          <div
            className={`cb-growth-boy${professional ? ' is-pro' : ''}`}
            style={{ left: boyLeft, bottom: boyBottom }}
          >
            <BoyFigure professional={professional} />
          </div>
        </div>
      </div>
    </div>
  );
}
