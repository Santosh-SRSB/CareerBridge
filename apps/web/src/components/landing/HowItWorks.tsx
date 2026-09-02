"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const steps = [
  {
    title: "Build Profile",
    body: "Start with name, city, education and skills. No 27-field government form — your Career Passport grows as you do.",
    image: "/how-it-works/build-profile.png",
  },
  {
    title: "Improve with AI",
    body: "Get resume guidance and mock-interview practice. AI suggests. You approve. It never invents experience.",
    image: "/how-it-works/improve-ai.png",
  },
  {
    title: "Find Jobs",
    body: "See roles that actually fit. Match explanations tell you why — and what to improve next.",
    image: "/how-it-works/find-jobs.png",
  },
  {
    title: "Get Hired",
    body: "Apply in a tap, track every stage, and keep improving until the offer lands.",
    image: "/how-it-works/get-hired.png",
  },
] as const;

function Magnifier() {
  return (
    <span className="hiw-orbit" aria-hidden="true">
      <span className="hiw-lens">
        <svg viewBox="0 0 48 48" width="44" height="44">
          <circle
            cx="20"
            cy="20"
            r="11"
            fill="rgba(255,255,255,0.18)"
            stroke="#eab308"
            strokeWidth="3"
          />
          <path
            d="M28.5 28.5 L38 38"
            fill="none"
            stroke="#eab308"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );
}

function StepVisual({
  src,
  alt,
  index,
  sizes,
  showMagnifier = false,
}: {
  src: string;
  alt: string;
  index: number;
  sizes: string;
  showMagnifier?: boolean;
}) {
  const contain = index === 1 || index === 2;
  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={contain ? "object-contain" : "object-cover"}
      />
      {showMagnifier ? <Magnifier /> : null}
    </>
  );
}

export function HowItWorks() {
  const rootRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [active, setActive] = useState(0);
  const [unlocked, setUnlocked] = useState<number[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.28 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started || picking) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setUnlocked([0, 1, 2, 3]);
      setPicking(true);
      setSelected(null);
      return;
    }

    let cancelled = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const play = (index: number) => {
      if (cancelled) return;
      setLeaving(false);
      setActive(index);
      later(() => {
        if (cancelled) return;
        setLeaving(true);
        later(() => {
          if (cancelled) return;
          setUnlocked((prev) => (prev.includes(index) ? prev : [...prev, index]));
          if (index < 3) play(index + 1);
          else {
            setLeaving(false);
            setPicking(true);
            setSelected(null);
          }
        }, 380);
      }, 2200);
    };

    play(0);
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [started, picking]);

  useEffect(() => {
    if (!picking) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [picking]);

  const step = steps[active];
  const focus = hover ?? selected;
  const barWidth = focus === null ? 0 : ((focus + 1) / steps.length) * 100;

  const pick = (index: number) => {
    setPicking(true);
    setLeaving(false);
    setSelected(index);
    setUnlocked([0, 1, 2, 3]);
  };

  return (
    <section
      id="how-it-works"
      ref={rootRef}
      className={`hiw-section bg-white${picking ? " is-done" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {!picking ? (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-navy">
              How it works
            </p>
            <h2 className="font-display mt-3 max-w-xl text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Four steps. One living career identity.
            </h2>
            <p className="mt-4 max-w-2xl text-sm text-muted sm:text-[15px]">
              Don&apos;t complete a complicated employment form. Build your
              professional identity progressively — and get value from the first
              session.
            </p>

            <div className="hiw-stage">
              <div className={`hiw-copy${leaving ? " is-leaving" : ""}`} key={step.title}>
                <h3 className="hiw-title">{step.title}</h3>
                <p className="hiw-body">{step.body}</p>
              </div>
              <div
                className={`hiw-card${leaving ? " is-leaving" : ""}${
                  active === 1 ? " is-ai" : ""
                }${active === 2 ? " is-jobs" : ""}`}
                key={`${step.title}-card`}
              >
                <StepVisual
                  src={step.image}
                  alt={step.title}
                  index={active}
                  sizes="(max-width: 768px) 100vw, 320px"
                  showMagnifier={active === 2}
                />
              </div>
            </div>
          </>
        ) : null}

        {picking ? (
          <div className="hiw-done">
            <p className="hiw-done-label">How it works</p>
            <div
              className="hiw-gallery"
              role="tablist"
              aria-label="How it works steps"
              onMouseLeave={() => setHover(null)}
            >
              {steps.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  role="tab"
                  aria-selected={selected === index}
                  className={`hiw-option${selected === index ? " is-on" : ""}${
                    index === 1 ? " is-ai" : ""
                  }${index === 2 ? " is-search" : ""}`}
                  onMouseEnter={() => setHover(index)}
                  onFocus={() => setHover(index)}
                  onClick={() => pick(index)}
                >
                  <span className="hiw-option-photo">
                    <StepVisual
                      src={item.image}
                      alt=""
                      index={index}
                      sizes="(max-width: 768px) 100vw, 25vw"
                    />
                  </span>
                  <span className="hiw-option-copy">
                    <span className="hiw-option-title">{item.title}</span>
                    {selected === index ? (
                      <span className="hiw-option-body">{item.body}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
            <div
              className="hiw-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={focus === null ? 0 : focus + 1}
              aria-label="Step progress"
            >
              <span className="hiw-bar-fill" style={{ width: `${barWidth}%` }} />
            </div>
          </div>
        ) : (
          <div className="hiw-picks" role="tablist" aria-label="How it works steps">
            {steps.map((item, index) =>
              unlocked.includes(index) ? (
                <button
                  key={item.title}
                  type="button"
                  className="hiw-pick"
                  onClick={() => pick(index)}
                >
                  {item.title}
                </button>
              ) : null,
            )}
          </div>
        )}
      </div>
    </section>
  );
}
