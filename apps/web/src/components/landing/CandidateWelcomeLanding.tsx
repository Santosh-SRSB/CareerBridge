'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { WelcomeFoot, WelcomeRoleNav } from '@/components/landing/WelcomeChrome';
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

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let n = 0;
    const id = window.setInterval(() => {
      const pics = slideRefs.current.filter(Boolean) as HTMLImageElement[];
      if (pics.length < 2) return;
      pics[n]?.classList.remove('on');
      n = (n + 1) % pics.length;
      pics[n]?.classList.add('on');
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.cw-item, .cw-cta');
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in');
        });
      },
      { threshold: 0.2 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="cw-page">
      <WelcomeRoleNav role="candidate" />
      <header className="cw-hero">
        <div className="cw-hero-slides" aria-hidden="true">
          {HERO_SLIDES.map((src, i) => (
            <img
              key={src}
              ref={(node) => {
                slideRefs.current[i] = node;
              }}
              className={i === 0 ? 'on' : undefined}
              src={src}
              alt=""
            />
          ))}
        </div>
        <div className="cw-hero__inner">
          <p className="cw-kicker">For candidates</p>
          <h1>Your career is bigger than your resume.</h1>
          <p>
            Build a Career Passport, practise with AI, and let the right work find you — free, in
            one quiet place.
          </p>
          <Link className="cw-go" href="/register?role=candidate">
            Start as candidate
          </Link>
        </div>
      </header>

      <div id="features">
        {CHAPTERS.map((ch) => (
          <section key={ch.num} className="cw-chap">
            <div className="cw-item">
              <div className="cw-item__txt">
                <div className="cw-num">{ch.num}</div>
                <h2>{ch.title}</h2>
                <p>{ch.body}</p>
              </div>
              <figure className="cw-item__pic">
                <img src={ch.img} alt="" />
              </figure>
            </div>
          </section>
        ))}
      </div>

      <section className="cw-cta" id="start">
        <h2>Ready to start your journey?</h2>
        <p>Create your free candidate account and build your Career Passport.</p>
        <Link href="/register?role=candidate">Signup as candidate</Link>
      </section>

      <WelcomeFoot role="candidate" />
    </div>
  );
}
