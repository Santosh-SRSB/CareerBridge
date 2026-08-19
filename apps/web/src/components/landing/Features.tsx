"use client";

import { useEffect, useRef, useState } from "react";

const features = [
  {
    tag: "Identity",
    title: "Career Passport",
    body: "Personal info, education, skills, projects and preferences in one living profile. Resumes become generated views — not the source of truth.",
    icon: "passport",
  },
  {
    tag: "AI Resume",
    title: "Builder that waits for you",
    body: "Pick a target job, see gaps, accept or skip suggestions, then generate, preview and download. AI never silently rewrites your history.",
    icon: "resume",
  },
  {
    tag: "Practice",
    title: "AI mock interviews",
    body: "Text-first practice for a real role. Scores, strengths and a next drill — coaching, not an exam. Voice comes later.",
    icon: "practice",
  },
  {
    tag: "Marketplace",
    title: "Jobs with a why",
    body: "Strong / Good / Potential match — plus the skills and location that got you there. No mystery AI score.",
    icon: "jobs",
  },
] as const;

function FeatureIcon({ kind }: { kind: (typeof features)[number]["icon"] }) {
  if (kind === "passport") {
    return (
      <svg viewBox="0 0 48 48" className="feat-icon" aria-hidden="true">
        <rect x="10" y="8" width="28" height="32" rx="6" fill="#0a2e2c" />
        <circle cx="24" cy="20" r="6" fill="#eab308" />
        <rect x="16" y="30" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.45)" />
      </svg>
    );
  }
  if (kind === "resume") {
    return (
      <svg viewBox="0 0 48 48" className="feat-icon" aria-hidden="true">
        <rect x="12" y="8" width="20" height="28" rx="4" fill="#fff" />
        <rect x="16" y="14" width="12" height="2.5" rx="1" fill="#0a2e2c" />
        <rect x="16" y="20" width="10" height="2" rx="1" fill="#c5d4d0" />
        <circle cx="34" cy="32" r="8" fill="#eab308" />
        <text x="34" y="36" textAnchor="middle" fontSize="9" fontWeight="800" fill="#0a2e2c">
          AI
        </text>
      </svg>
    );
  }
  if (kind === "practice") {
    return (
      <svg viewBox="0 0 48 48" className="feat-icon" aria-hidden="true">
        <rect x="8" y="12" width="22" height="14" rx="6" fill="#0a2e2c" />
        <rect x="18" y="24" width="22" height="14" rx="6" fill="#eab308" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="feat-icon" aria-hidden="true">
      <rect x="8" y="14" width="32" height="8" rx="4" fill="#0a2e2c" />
      <rect x="8" y="26" width="24" height="8" rx="4" fill="#ca8a04" />
      <rect x="8" y="38" width="16" height="4" rx="2" fill="#14b8a6" />
    </svg>
  );
}

export function Features() {
  const rootRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [spot, setSpot] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.22 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || hover !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setSpot((n) => (n + 1) % features.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [seen, hover]);

  const focus = hover ?? spot;
  const barWidth = ((focus + 1) / features.length) * 100;

  return (
    <section id="passport" ref={rootRef} className="feat-section bg-fog py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-deep">
          What you get
        </p>
        <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          A Career Passport, not another resume dump.
        </h2>

        <div
          className="feat-grid"
          onMouseLeave={() => setHover(null)}
        >
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`feat-card${seen ? " is-in" : ""}${
                focus === index ? " is-on" : ""
              }`}
              style={{ transitionDelay: `${index * 0.12}s` }}
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              tabIndex={0}
            >
              <span className="feat-shine" aria-hidden="true" />
              <div className="feat-top">
                <span className="feat-tag">{feature.tag}</span>
                <FeatureIcon kind={feature.icon} />
              </div>
              <h3 className="feat-title">{feature.title}</h3>
              <p className="feat-body">{feature.body}</p>
            </article>
          ))}
        </div>

        <div
          className="feat-bar"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={focus + 1}
          aria-label="Feature highlight"
        >
          <span className="feat-bar-fill" style={{ width: `${barWidth}%` }} />
        </div>
      </div>
    </section>
  );
}
