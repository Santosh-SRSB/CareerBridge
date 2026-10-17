"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

const DECK = [
  {
    name: "Rahul Kumar",
    initials: "RK",
    tone: "#eab308",
    loc: "Chennai · Customer Service",
    ready: 78,
    resume: 72,
    interview: 68,
    skills: ["Communication", "MS Excel"],
  },
  {
    name: "Priya Sharma",
    initials: "PS",
    tone: "#14b8a6",
    loc: "Bengaluru · Data Analyst",
    ready: 64,
    resume: 70,
    interview: 58,
    skills: ["SQL", "Excel"],
  },
  {
    name: "Arjun Patel",
    initials: "AP",
    tone: "#f97316",
    loc: "Pune · Sales Associate",
    ready: 71,
    resume: 63,
    interview: 74,
    skills: ["CRM", "Hindi"],
  },
];

const RING = 2 * Math.PI * 42;

function useCountUp(target: number, play: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!play) {
      setValue(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, play, duration]);

  return value;
}

export function PassportDeck() {
  const [index, setIndex] = useState(0);
  const [counting, setCounting] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const card = DECK[index];
  const ready = useCountUp(card.ready, counting);
  const resume = useCountUp(card.resume, counting, 1200);
  const interview = useCountUp(card.interview, counting, 1300);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setCounting(true);
      return;
    }

    let cancelled = false;
    let dealTimer = 0;
    let countTimer = 0;
    let nextTimer = 0;

    const show = (i: number) => {
      setCounting(false);
      setDealing(true);
      dealTimer = window.setTimeout(() => {
        if (cancelled) return;
        setIndex(i);
      }, 280);
      countTimer = window.setTimeout(() => {
        if (cancelled) return;
        setDealing(false);
        setCounting(true);
        nextTimer = window.setTimeout(() => {
          if (cancelled) return;
          show((i + 1) % DECK.length);
        }, 4500);
      }, 620);
    };

    show(0);
    return () => {
      cancelled = true;
      window.clearTimeout(dealTimer);
      window.clearTimeout(countTimer);
      window.clearTimeout(nextTimer);
    };
  }, []);

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    setTilt({ x: py * -8, y: px * 10 });
  };

  return (
    <div
      ref={stageRef}
      className="passport-stage"
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div className="passport-stack">
      <span className="passport-slip passport-slip-a" aria-hidden="true" />
      <span className="passport-slip passport-slip-b" aria-hidden="true" />
      <article
        className={`passport-lite${dealing ? " is-dealing" : ""}`}
        style={
          dealing
            ? undefined
            : {
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold text-[#062120] ring-2 ring-white/25"
              style={{ background: card.tone }}
            >
              {card.initials}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-bright">
                Career Passport
              </p>
              <h2 className="font-display mt-1.5 text-[22px] font-extrabold leading-tight sm:text-[24px]">
                {card.name}
              </h2>
              <p className="mt-1 text-[13px] text-white/55">{card.loc}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-orange-bright px-3 py-1 text-[11px] font-bold text-[#2a1f00]">
            FREE
          </span>
        </div>

        <div className="mt-6 flex items-center gap-5">
          <div className="relative h-[108px] w-[108px] shrink-0">
            <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90">
              <circle
                cx="54"
                cy="54"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="7"
              />
              <circle
                cx="54"
                cy="54"
                r="42"
                fill="none"
                stroke="#eab308"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - ready / 100)}
                className="passport-ring"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[26px] font-extrabold leading-none text-orange-bright">
                {ready}
              </span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                ready
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-5 text-white/60">
              Profile rising to a stronger match.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {card.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-white/[0.06] px-3.5 py-3">
            <p className="text-[11px] text-white/50">Resume</p>
            <p className="font-display text-xl font-extrabold text-orange-bright">
              {resume}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.06] px-3.5 py-3">
            <p className="text-[11px] text-white/50">Interview</p>
            <p className="font-display text-xl font-extrabold text-orange-bright">
              {interview}
            </p>
          </div>
        </div>
      </article>
      </div>
    </div>
  );
}
