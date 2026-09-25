'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { WelcomeFoot, WelcomeRoleNav } from '@/components/landing/WelcomeChrome';
import '@/components/landing/welcome-landings.css';

const BANDS = [
  {
    tone: 'c1',
    flip: false,
    title: 'Create job requirements',
    body: 'Define the role, skills and experience once, in a structured form. Every candidate you see is measured against the same clear brief.',
    tags: ['Skills', 'Experience', 'Role details'],
    img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
  },
  {
    tone: 'c2',
    flip: true,
    title: 'AI-powered matching',
    body: 'Get matched with candidates by skills, experience and role fit, so your first look is already your best look.',
    tags: ['Skill match', 'Role fit'],
    img: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80',
  },
  {
    tone: 'c3',
    flip: false,
    title: 'Structured candidate profiles',
    body: 'Review standardized profiles with verified information and AI insights, and compare people side by side on equal terms.',
    tags: ['Verified information', 'AI insights'],
    img: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1200&q=80',
  },
  {
    tone: 'c4',
    flip: true,
    title: 'Candidate shortlisting',
    body: 'Shortlist the most relevant candidates faster, with AI doing the first sort and you making the final call.',
    tags: ['AI-assisted', 'Faster decisions'],
    img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
  },
  {
    tone: 'c5',
    flip: false,
    title: 'Interview management',
    body: 'Schedule interviews, share updates and keep candidates informed, all without leaving the platform.',
    tags: ['Scheduling', 'Updates', 'Communication'],
    img: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80',
  },
  {
    tone: 'c6',
    flip: true,
    title: 'Hiring pipeline',
    body: 'Track every candidate across every stage. Bring your team in, and use talent insights on skills and role suitability to decide together.',
    tags: ['Pipeline stages', 'Talent insights', 'Team collaboration'],
    img: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
  },
] as const;

const HERO_LINE = 'Great teams are built, not searched for.';

export function EmployerWelcomeLanding() {
  const lineRef = useRef<HTMLHeadingElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.textContent = HERO_LINE;
      el.classList.add('done');
      return;
    }
    let i = 0;
    let timer = 0;
    const tick = () => {
      el.textContent = HERO_LINE.slice(0, i);
      i += 1;
      if (i <= HERO_LINE.length) timer = window.setTimeout(tick, 38);
      else el.classList.add('done');
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.ew-row, .ew-feat-head, .ew-cta');
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in');
        });
      },
      { threshold: 0.22 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ew-page">
      <WelcomeRoleNav role="employer" />
      <header className="ew-hero">
        <div className="ew-hero-slides" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="ew-heroIn">
          <h1 ref={lineRef} data-text={HERO_LINE} aria-label={HERO_LINE} />
          <p>
            Post what you need. Meet people who already fit. Spend your time on interviews, not on
            inboxes.
          </p>
          <a href="#features" className="ew-explore">
            Explore{' '}
            <b>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </b>
          </a>
        </div>
      </header>

      <section className="ew-feat-head" id="features">
        <div className="ew-wrap">
          <h2>Hire smarter. Spend less time searching.</h2>
          <p className="ew-intro">
            One workspace for the whole hiring journey, from the first requirement to the final
            offer.
          </p>
        </div>
      </section>

      {BANDS.map((band) => (
        <section
          key={band.title}
          className={`ew-band ${band.tone}${band.flip ? ' flip' : ''}`}
        >
          <div className="ew-wrap">
            <article className="ew-row">
              <figure className="ew-pic">
                <img
                  src={band.img}
                  alt=""
                  onClick={() => setLightbox(band.img)}
                />
              </figure>
              <div>
                <h3>{band.title}</h3>
                <p>{band.body}</p>
                <div className="ew-tags">
                  {band.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>
      ))}

      <section className="ew-cta" id="start">
        <h2>Ready to build your team?</h2>
        <p>Create your employer account and post your first role today.</p>
        <div className="ew-ctaBtns">
          <Link className="ew-btn solid" href="/employer/register">
            Signup as employer
          </Link>
          <Link className="ew-btn ghost" href="/login?role=employer">
            Login
          </Link>
        </div>
      </section>

      <WelcomeFoot role="employer" />

      <div
        className={`ew-lightbox${lightbox ? ' on' : ''}`}
        id="box"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
        onClick={() => setLightbox(null)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setLightbox(null);
        }}
      >
        {lightbox ? <img src={lightbox} alt="" /> : null}
      </div>
    </div>
  );
}
