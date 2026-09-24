"use client";

import { useEffect, useRef, useState } from "react";
import { getPlatformStats } from "@/lib/api";

const FALLBACK = {
  passports: 150,
  cities: 15,
  jobs: 480,
} as const;

type LiveStats = {
  passports: number;
  cities: number;
  jobs: number;
};

function buildBeats(stats: LiveStats) {
  return [
    {
      value: Math.max(0, stats.passports),
      label: "Passports",
      title: "Career Passports",
      detail: "No fees for candidates",
    },
    {
      value: Math.max(0, stats.cities),
      label: "Cities",
      title: "From cities",
      detail: "Candidates across the map",
    },
    {
      value: Math.max(0, stats.jobs),
      label: "Jobs",
      title: "Open jobs",
      detail: "Live roles hiring now",
    },
  ] as const;
}

type Phase = 0 | 1 | 2 | 3;

function CheerBoy() {
  return (
    <svg className="cheer-boy" viewBox="0 0 88 96" width="72" height="78" aria-hidden="true">
      <ellipse cx="44" cy="90" rx="18" ry="4" fill="rgba(10,46,44,0.12)" />
      <path
        className="cheer-arm-l"
        d="M28 52 C12 38 8 28 10 18"
        fill="none"
        stroke="#f4b183"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        className="cheer-arm-r"
        d="M60 52 C76 38 80 28 78 18"
        fill="none"
        stroke="#f4b183"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="16" r="4.2" fill="#f4b183" />
      <circle cx="78" cy="16" r="4.2" fill="#f4b183" />
      <path d="M32 50 Q44 58 56 50 L54 78 Q44 82 34 78 Z" fill="#0a2e2c" />
      <rect x="34" y="76" width="8" height="14" rx="3" fill="#1e3a36" />
      <rect x="46" y="76" width="8" height="14" rx="3" fill="#1e3a36" />
      <circle cx="44" cy="32" r="14" fill="#f4b183" />
      <path d="M30 30 C32 16 56 16 58 30 C50 24 38 24 30 30" fill="#3b2416" />
      <circle cx="39" cy="33" r="1.6" fill="#1a120c" />
      <circle cx="49" cy="33" r="1.6" fill="#1a120c" />
      <path
        d="M40 40 Q44 44 48 40"
        fill="none"
        stroke="#b45309"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HeroProof() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [phase, setPhase] = useState<Phase>(0);
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const statsRef = useRef<LiveStats>({ ...FALLBACK });

  useEffect(() => {
    let cancelled = false;
    void getPlatformStats()
      .then((data) => {
        if (cancelled) return;
        const next = {
          passports: Number(data.passports) || FALLBACK.passports,
          cities: Number(data.cities) || FALLBACK.cities,
          jobs: Number(data.jobs) || FALLBACK.jobs,
        };
        statsRef.current = next;
        setStats(next);
      })
      .catch(() => {
        if (cancelled) return;
        statsRef.current = { ...FALLBACK };
        setStats({ ...FALLBACK });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!stats) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase(3);
      return;
    }

    let cancelled = false;
    let raf = 0;
    const timers: number[] = [];

    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const countTo = (target: number, done: () => void) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / 900);
        const eased = 1 - (1 - t) ** 3;
        setShown(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
        else done();
      };
      raf = requestAnimationFrame(tick);
    };

    const runBeat = (index: Phase) => {
      if (cancelled) return;
      const beats = buildBeats(statsRef.current);
      setLeaving(false);
      setPhase(index);
      setShown(0);

      if (index === 3) {
        later(() => runBeat(0), 3800);
        return;
      }

      countTo(beats[index].value, () => {
        later(() => {
          if (cancelled) return;
          setLeaving(true);
          later(() => runBeat((index + 1) as Phase), 280);
        }, 1600);
      });
    };

    runBeat(0);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [stats]);

  if (!stats) {
    return (
      <div className="hero-proof">
        <div className="hero-proof-box" aria-busy="true">
          <p className="hero-proof-kicker">Loading live stats…</p>
        </div>
      </div>
    );
  }

  const beats = buildBeats(stats);
  const beat = phase < 3 ? beats[phase] : null;

  return (
    <div className="hero-proof">
      <div className={`hero-proof-box${phase === 3 ? " is-finale" : ""}`} aria-live="polite">
        {beat ? (
          <div className={`hero-proof-beat${leaving ? " is-leaving" : ""}`}>
            <div className="hero-proof-copy">
              <p className="hero-proof-kicker">{beat.detail}</p>
              <p className="hero-proof-title">{beat.title}</p>
            </div>
            <div className="hero-proof-count">
              <p className="hero-proof-count-label">{beat.label}</p>
              <p className="hero-proof-count-num">{shown}</p>
            </div>
          </div>
        ) : (
          <div className="hero-proof-finale">
            <CheerBoy />
            <p className="hero-proof-finale-text">Every career has a next step. Find yours.</p>
          </div>
        )}
      </div>
    </div>
  );
}
