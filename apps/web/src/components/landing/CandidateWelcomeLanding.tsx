'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { WelcomeRoleNav } from '@/components/landing/WelcomeChrome';
import { HomeFooter } from '@/components/landing/home/HomeFooter';
import { ArrowRightIcon, PassportIcon, UserIcon } from '@/components/landing/home/icons';
import { useWelcomeReveal } from '@/components/landing/useWelcomeReveal';
import '@/components/landing/home/home-landing.css';
import '@/components/landing/welcome-landings.css';

const HERO_SLIDES = [
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=2000&h=1100&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=2000&h=1100&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=2000&h=1100&q=80',
] as const;

const CHAPTERS = [
  {
    num: '01',
    title: 'Career Passport',
    body: 'Your professional identity in one place. Organized, verified and always up to date, so employers see the real you.',
    img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&h=1000&q=80',
  },
  {
    num: '02',
    title: 'AI resume and ATS analysis',
    body: 'Get AI insights on your profile strength and exactly how to improve your chances of getting shortlisted.',
    img: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&h=1000&q=80',
  },
  {
    num: '03',
    title: 'AI mock interviews',
    body: 'Practice role-specific interviews with AI and get detailed feedback, so the real one feels familiar.',
    img: 'https://images.unsplash.com/photo-1616587894289-86480e533129?auto=format&fit=crop&w=1600&h=1000&q=80',
  },
  {
    num: '04',
    title: 'Skill gap analysis',
    body: 'Find the skills you are missing and get personalized recommendations on what to learn next.',
    img: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1600&h=1000&q=80',
  },
  {
    num: '05',
    title: 'Smart job discovery',
    body: 'Find jobs that match your skills, experience, preferences and location.',
    img: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1600&h=1000&q=80',
  },
  {
    num: '06',
    title: 'Interview tracking',
    body: 'Keep applications, upcoming interviews and hiring progress together.',
    img: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1600&h=1000&q=80',
  },
] as const;

export function CandidateWelcomeLanding() {
  const slideRefs = useRef<(HTMLImageElement | null)[]>([]);
  useWelcomeReveal();

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let n = 0;
    const id = window.setInterval(() => {
      const pics = slideRefs.current.filter(Boolean) as HTMLImageElement[];
      if (pics.length < 2) return;
      pics[n]?.classList.remove('is-on');
      n = (n + 1) % pics.length;
      pics[n]?.classList.add('is-on');
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hl-page wl-page">
      <WelcomeRoleNav role="candidate" />

      <main>
        <section className="wl-hero wl-hero--candidate">
          <div className="wl-wrap wl-hero__grid">
            <div className="wl-hero__copy">
              <p className="hl-cap">
                <UserIcon size={16} />
                For candidates
              </p>
              <h1 className="wl-hero__title">
                Your career is bigger than your <em>resume.</em>
              </h1>
              <p className="wl-hero__lede">
                Build a Career Passport, practise with AI, and let the right work find you — free, in
                one quiet place.
              </p>
              <div className="wl-hero__ctas">
                <Link className="hl-btn hl-btn--primary hl-btn--lg" href="/register?role=candidate">
                  Start as candidate
                  <ArrowRightIcon size={18} />
                </Link>
                <a className="hl-btn hl-btn--ghost hl-btn--on-white hl-btn--lg" href="#features">
                  See features
                </a>
              </div>
            </div>

            <div className="wl-hero__media" aria-hidden="true">
              <div className="wl-slides">
                {HERO_SLIDES.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- remote decorative slide
                  <img
                    key={src}
                    ref={(node) => {
                      slideRefs.current[i] = node;
                    }}
                    className={i === 0 ? 'is-on' : undefined}
                    src={src}
                    alt=""
                  />
                ))}
              </div>
              <div className="wl-float">
                <span className="wl-float__icon">
                  <PassportIcon size={20} />
                </span>
                <span>
                  <strong>Career Passport</strong>
                  <small>Build yours for free</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="wl-section" id="features" aria-labelledby="wl-features-title">
          <div className="wl-wrap">
            <div className="wl-head wl-observe">
              <p className="hl-eyebrow hl-reveal">Candidate features</p>
              <h2 className="wl-head__title hl-reveal" id="wl-features-title">
                Everything you need to get <em>hired.</em>
              </h2>
            </div>

            <div className="wl-rows">
              {CHAPTERS.map((ch, i) => (
                <article key={ch.num} className={`wl-row wl-observe${i % 2 ? ' wl-row--flip' : ''}`}>
                  <figure className="wl-row__media hl-reveal">
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote decorative image */}
                    <img src={ch.img} alt="" loading="lazy" />
                  </figure>
                  <div className="wl-row__copy hl-reveal">
                    <span className="wl-num" aria-hidden="true">
                      {ch.num}
                    </span>
                    <h3 className="wl-row__title">{ch.title}</h3>
                    <p className="wl-row__body">{ch.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="wl-cta" id="start">
          <div className="wl-cta__card wl-observe">
            <svg className="wl-cta__deco" viewBox="0 0 520 520" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">
              <circle cx="260" cy="260" r="80" strokeWidth="2" />
              <circle cx="260" cy="260" r="140" strokeWidth="2" strokeDasharray="4 10" />
              <circle cx="260" cy="260" r="200" strokeWidth="2" />
            </svg>
            <h2 className="wl-cta__title hl-reveal">Ready to start your journey?</h2>
            <p className="wl-cta__text hl-reveal">
              Create your free candidate account and build your Career Passport.
            </p>
            <div className="wl-cta__actions hl-reveal">
              <Link className="hl-pill wl-pill--light" href="/register?role=candidate">
                Signup as candidate
                <span className="hl-pill__arrow">
                  <ArrowRightIcon size={18} />
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <HomeFooter welcome="candidate" />
    </div>
  );
}
