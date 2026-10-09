'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WelcomeRoleNav } from '@/components/landing/WelcomeChrome';
import { HomeFooter } from '@/components/landing/home/HomeFooter';
import { ArrowRightIcon, BriefcaseIcon, CloseIcon } from '@/components/landing/home/icons';
import { useWelcomeReveal } from '@/components/landing/useWelcomeReveal';
import '@/components/landing/home/home-landing.css';
import '@/components/landing/welcome-landings.css';

const BANDS = [
  {
    title: 'Create job requirements',
    body: 'Define the role, skills and experience once, in a structured form. Every candidate you see is measured against the same clear brief.',
    tags: ['Skills', 'Experience', 'Role details'],
    img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'AI-powered matching',
    body: 'Get matched with candidates by skills, experience and role fit, so your first look is already your best look.',
    tags: ['Skill match', 'Role fit'],
    img: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Structured candidate profiles',
    body: 'Review standardized profiles with verified information and AI insights, and compare people side by side on equal terms.',
    tags: ['Verified information', 'AI insights'],
    img: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Candidate shortlisting',
    body: 'Shortlist the most relevant candidates faster, with AI doing the first sort and you making the final call.',
    tags: ['AI-assisted', 'Faster decisions'],
    img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Interview management',
    body: 'Schedule interviews, share updates and keep candidates informed, all without leaving the platform.',
    tags: ['Scheduling', 'Updates', 'Communication'],
    img: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80',
  },
  {
    title: 'Hiring pipeline',
    body: 'Track every candidate across every stage. Bring your team in, and use talent insights on skills and role suitability to decide together.',
    tags: ['Pipeline stages', 'Talent insights', 'Team collaboration'],
    img: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
  },
] as const;

type Band = (typeof BANDS)[number];

const HERO_LINE = 'Great teams are built, not searched for.';

function Lightbox({ band, onClose }: { band: Band; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="wl-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${band.title} image preview`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button ref={closeRef} type="button" className="wl-lightbox__close" aria-label="Close image preview" onClick={onClose}>
        <CloseIcon size={22} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote preview image */}
      <img src={band.img} alt={band.title} />
    </div>
  );
}

export function EmployerWelcomeLanding() {
  const lineRef = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState<Band | null>(null);
  const previewOpenerRef = useRef<HTMLButtonElement | null>(null);
  const closePreview = useCallback(() => setPreview(null), []);
  useWelcomeReveal();

  // The page is inert while the preview is open, so focus can only go back once it closes.
  useEffect(() => {
    if (!preview) previewOpenerRef.current?.focus();
  }, [preview]);

  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.textContent = HERO_LINE;
      el.classList.add('is-done');
      return;
    }
    let i = 0;
    let timer = 0;
    const tick = () => {
      el.textContent = HERO_LINE.slice(0, i);
      i += 1;
      if (i <= HERO_LINE.length) timer = window.setTimeout(tick, 38);
      else el.classList.add('is-done');
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="hl-page wl-page">
      <div inert={preview ? true : undefined}>
        <WelcomeRoleNav role="employer" />

        <main>
          <section className="wl-hero wl-hero--employer">
            <div className="wl-bg" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="wl-hero__center">
              <p className="hl-cap wl-cap--dark">
                <BriefcaseIcon size={16} />
                For employers
              </p>
              <h1 className="wl-type" aria-label={HERO_LINE}>
                <span className="wl-type__ghost" aria-hidden="true">
                  {HERO_LINE}
                </span>
                <span ref={lineRef} className="wl-type__text" aria-hidden="true" />
              </h1>
              <p className="wl-hero__lede wl-hero__lede--dark">
                Post what you need. Meet people who already fit. Spend your time on interviews, not on
                inboxes.
              </p>
              <a href="#features" className="hl-btn hl-btn--light hl-btn--lg wl-explore">
                Explore
                <ArrowRightIcon size={18} />
              </a>
            </div>
          </section>

          <section className="wl-features" id="features" aria-labelledby="wl-features-title">
            <div className="wl-wrap">
              <div className="wl-head wl-observe">
                <p className="hl-eyebrow hl-reveal">Employer features</p>
                <h2 className="wl-head__title hl-reveal" id="wl-features-title">
                  Hire smarter. Spend less time <em>searching.</em>
                </h2>
                <p className="wl-head__lede hl-reveal">
                  One workspace for the whole hiring journey, from the first requirement to the final
                  offer.
                </p>
              </div>
            </div>

            {BANDS.map((band, i) => (
              <div key={band.title} className="wl-band">
                <div className="wl-wrap">
                  <article className={`wl-row wl-observe${i % 2 ? ' wl-row--flip' : ''}`}>
                    <figure className="wl-row__media hl-reveal">
                      <button
                        type="button"
                        className="wl-zoom"
                        aria-label={`View larger image: ${band.title}`}
                        onClick={(event) => {
                          previewOpenerRef.current = event.currentTarget;
                          setPreview(band);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- remote decorative image */}
                        <img src={band.img} alt="" loading="lazy" />
                      </button>
                    </figure>
                    <div className="wl-row__copy hl-reveal">
                      <span className="wl-num" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="wl-row__title">{band.title}</h3>
                      <p className="wl-row__body">{band.body}</p>
                      <ul className="wl-tags" aria-label={`${band.title} highlights`}>
                        {band.tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </div>
              </div>
            ))}
          </section>

          <section className="wl-cta" id="start">
            <div className="wl-cta__card wl-observe">
              <svg className="wl-cta__deco" viewBox="0 0 520 520" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">
                <circle cx="260" cy="260" r="80" strokeWidth="2" />
                <circle cx="260" cy="260" r="140" strokeWidth="2" strokeDasharray="4 10" />
                <circle cx="260" cy="260" r="200" strokeWidth="2" />
              </svg>
              <h2 className="wl-cta__title hl-reveal">Ready to build your team?</h2>
              <p className="wl-cta__text hl-reveal">Create your employer account and post your first role today.</p>
              <div className="wl-cta__actions hl-reveal">
                <Link className="hl-btn hl-btn--light hl-btn--lg" href="/employer/register">
                  Signup as employer
                  <ArrowRightIcon size={18} />
                </Link>
                <Link className="hl-btn hl-btn--lg wl-btn--outline-light" href="/login?role=employer">
                  Login
                </Link>
              </div>
            </div>
          </section>
        </main>

        <HomeFooter welcome="employer" />
      </div>

      {preview ? <Lightbox band={preview} onClose={closePreview} /> : null}
    </div>
  );
}
