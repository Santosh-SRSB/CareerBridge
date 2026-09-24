'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ACCENT = '#0a2e2c';
const MUTED = '#8a8780';
const BG = '#f7f6f2';

const SLIDES = [
  {
    label: 'Start here',
    title: 'Build your dossier',
    body: 'Capture your profile, education and experience in one clean pass.',
    art: 'dossier',
  },
  {
    label: 'Show your range',
    title: 'Showcase your work',
    body: 'Skills, projects and certifications, laid out so reviewers see the highlights fast.',
    art: 'work',
  },
  {
    label: 'Be found',
    title: 'Get discovered',
    body: 'Add your links and preferences so the right roles can find you first.',
    art: 'radar',
  },
  {
    label: 'All set',
    title: 'A complete profile always gives you an edge',
    body: 'Review everything, then submit. Most people finish in under five minutes.',
    art: 'check',
  },
] as const;

const AUTO_MS = 1400;

function SlideArt({ kind }: { kind: (typeof SLIDES)[number]['art'] }) {
  if (kind === 'dossier') {
    return (
      <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
        <span className="absolute left-4 top-10 h-2 w-2 rounded-full bg-[#0a2e2c]" />
        <div className="relative h-28 w-20 rounded-md border border-[#1c1c1a] bg-[#f0e8d8] shadow-sm">
          <div className="absolute right-[-4px] top-3 h-2 w-2 rounded-full bg-[#0a2e2c]" />
          <div className="mt-6 space-y-2 px-3">
            <div className="h-1 w-10 rounded bg-[#1c1c1a]/70" />
            <div className="h-1 w-8 rounded bg-[#1c1c1a]/50" />
            <div className="h-1 w-11 rounded bg-[#1c1c1a]/40" />
          </div>
          <div className="absolute bottom-3 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-[#1c1c1a] bg-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'work') {
    return (
      <div className="relative mx-auto flex h-36 w-40 items-center justify-center">
        <div className="absolute left-2 top-8 h-20 w-14 rotate-[-8deg] rounded-md border border-[#c4b8a0] bg-[#f5efe4]" />
        <div className="absolute right-3 top-6 h-22 w-16 rotate-[6deg] rounded-md border border-[#d4c4a8] bg-[#ebe3d4]" />
        <div className="relative z-10 h-24 w-16 rounded-md border border-[#1c1c1a] bg-white px-2.5 pt-4 shadow-sm">
          <div className="space-y-1.5">
            <div className="h-1 w-9 rounded bg-[#1c1c1a]/60" />
            <div className="h-1 w-7 rounded bg-[#1c1c1a]/45" />
            <div className="h-1 w-8 rounded bg-[#1c1c1a]/35" />
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'radar') {
    return (
      <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
        {[28, 44, 60, 76].map((size) => (
          <div
            key={size}
            className="absolute rounded-full border border-[#d0cdc4]"
            style={{ width: size, height: size }}
          />
        ))}
        <div className="absolute h-2 w-2 rounded-full bg-[#0a2e2c]" />
        <div className="absolute left-[28%] top-[30%] h-1.5 w-1.5 rounded-full bg-[#0a2e2c]" />
        <div className="absolute right-[26%] top-[38%] h-1.5 w-1.5 rounded-full bg-[#8a8780]" />
        <div className="absolute bottom-[28%] left-[40%] h-1.5 w-1.5 rounded-full bg-[#0a2e2c]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 144 144" aria-hidden>
          <line x1="72" y1="72" x2="48" y2="48" stroke="#c8c5bc" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="72" y1="72" x2="104" y2="58" stroke="#c8c5bc" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="72" y1="72" x2="62" y2="100" stroke="#c8c5bc" strokeWidth="1" strokeDasharray="3 3" />
        </svg>
      </div>
    );
  }
  return (
    <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
      <span className="absolute left-8 top-8 h-2 w-2 rounded-full bg-[#0a2e2c]" />
      <span className="absolute right-10 top-12 h-1.5 w-1.5 rounded-full bg-[#8a8780]" />
      <span className="absolute bottom-10 right-8 h-2 w-2 rounded-full bg-[#0a2e2c]" />
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#1c1c1a] bg-[#efe7d8]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>
  );
}

export default function DossierIntroPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const goForm = useCallback(() => {
    // Resume path: upload existing OR build ATS resume (previous onboarding complete flow).
    router.push('/onboarding/complete');
  }, [router]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= SLIDES.length - 1) return i;
      return i + 1;
    });
  }, []);

  useEffect(() => {
    if (paused || last) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setTimeout(next, AUTO_MS);
    return () => window.clearTimeout(t);
  }, [index, last, next, paused]);

  return (
    <main
      className="flex min-h-dvh flex-col px-5 pb-8 pt-6"
      style={{ background: BG, color: ACCENT }}
      onPointerDown={() => setPaused(true)}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between text-sm" style={{ color: MUTED }}>
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-[#0a2e2c]"
            onClick={() => {
              if (index > 0) {
                setPaused(true);
                setIndex((i) => Math.max(0, i - 1));
                return;
              }
              router.back();
            }}
            aria-label="Go back"
          >
            <span aria-hidden className="text-lg leading-none">
              ‹
            </span>
            Back
          </button>
          <span>
            {index + 1}/{SLIDES.length}
          </span>
          <button
            type="button"
            className="font-medium"
            onClick={() => {
              if (last) goForm();
              else setIndex(SLIDES.length - 1);
            }}
          >
            Skip
          </button>
        </div>

        <div
          key={index}
          className="flex flex-1 flex-col items-center justify-center px-2 text-center cb-dossier-slide-in"
        >
          <SlideArt kind={slide.art} />
          <p
            className="mt-8 text-xs tracking-wide"
            style={{
              color: MUTED,
              fontFamily: 'var(--font-space-mono), ui-monospace, monospace',
            }}
          >
            {slide.label}
          </p>
          <h1
            className="mt-3 max-w-[18rem] text-[1.65rem] font-semibold leading-tight sm:text-[1.85rem]"
            style={{
              fontFamily: "var(--font-fraunces), Georgia, 'Times New Roman', serif",
              color: ACCENT,
            }}
          >
            {slide.title}
          </h1>
          <p className="mt-3 max-w-[20rem] text-[15px] leading-relaxed" style={{ color: MUTED }}>
            {slide.body}
          </p>
        </div>

        <div className="mt-auto space-y-5">
          <div className="flex justify-center gap-2" aria-hidden>
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === index ? 28 : 18,
                  background: i <= index ? ACCENT : '#d8d5cc',
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (last) goForm();
              else {
                setPaused(true);
                next();
              }
            }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-white transition hover:opacity-95 active:scale-[0.99]"
            style={{ background: ACCENT }}
          >
            {last ? 'Get started' : 'Next'}
            <span aria-hidden className="text-lg leading-none">
              ›
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
