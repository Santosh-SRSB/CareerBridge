'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const FEATURES = [
  {
    short: 'AI Profile',
    title: 'AI-Powered Profile',
    body: 'Create a comprehensive profile that showcases your skills, experience and achievements.',
    img: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=900&q=80',
  },
  {
    short: 'Passport',
    title: 'Career Passport',
    body: 'Your professional identity in one place. Organized, verified and always up to date.',
    img: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=900&q=80',
  },
  {
    short: 'ATS Analysis',
    title: 'AI Resume & ATS Analysis',
    body: 'Get AI insights on your profile strength and how to improve your chances.',
    img: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=900&q=80',
  },
  {
    short: 'Skill Gaps',
    title: 'Skill Gap Analysis',
    body: 'Identify missing skills and get personalized recommendations to grow faster.',
    img: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
  },
  {
    short: 'Mock Interview',
    title: 'AI Mock Interviews',
    body: 'Practice role-specific interviews with AI and get detailed feedback.',
    img: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=80',
  },
  {
    short: 'Job Discovery',
    title: 'Smart Job Discovery',
    body: 'Find jobs that match your skills, experience, preferences and location.',
    img: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
  },
  {
    short: 'Career Gaps',
    title: 'Career Gap Insights',
    body: 'Understand your career gaps and learn how to present your journey effectively.',
    img: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80',
  },
  {
    short: 'Tracking',
    title: 'Interview Tracking',
    body: 'Track your applications, upcoming interviews and hiring progress.',
    img: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80',
  },
] as const;

const EMP_STAGES = [
  {
    n: '01',
    title: 'Create Job Requirements',
    body: 'Define role, skills, experience and other requirements in a structured way.',
    img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
    extras: [
      ['Structured briefs', 'Role, skills and experience in one brief.'],
      ['Clear scorecard', 'What good looks like before you search.'],
    ],
  },
  {
    n: '02',
    title: 'AI-Powered Matching',
    body: 'Get matched with relevant candidates based on skills, experience and role fit.',
    img: 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=80',
    extras: [
      ['Ranked talent', 'See fit, not just a pile of CVs.'],
      ['Less search', 'The desk brings people to you.'],
    ],
  },
  {
    n: '03',
    title: 'Candidate Shortlisting',
    body: 'Shortlist the most relevant candidates faster with AI assistance.',
    img: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80',
    extras: [
      ['Structured profiles', 'Verified information with AI insights.'],
      ['Faster moves', 'Send the right people forward.'],
    ],
  },
  {
    n: '04',
    title: 'Interview Management',
    body: 'Schedule interviews, share updates and communicate seamlessly.',
    img: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80',
    extras: [
      ['One calendar', 'Book time without the email chain.'],
      ['Tight loop', 'Candidates always know the next step.'],
    ],
  },
  {
    n: '05',
    title: 'Hiring Pipeline',
    body: 'Track candidates across different stages of your hiring process.',
    img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    extras: [
      ['Talent insights', 'Skills, gaps and role suitability.'],
      ['Team collaboration', 'Share notes and decide together.'],
    ],
  },
] as const;

function norm(d: number) {
  return (((d + 180) % 360) + 360) % 360 - 180;
}

export function DayOrbitJourney() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(360);
  const [angle, setAngle] = useState(-90);
  const [activeFeature, setActiveFeature] = useState(1);
  const [cardHide, setCardHide] = useState(false);
  const [empIndex, setEmpIndex] = useState(0);
  const empHoldRef = useRef(false);
  const lastShownRef = useRef(1);
  const wasNearRef = useRef(false);
  const angleRef = useRef(-90);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageW(el.clientWidth || 360);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!reduce) {
        angleRef.current += dt * 0.006;
        setAngle(angleRef.current);
      }

      let best = 0;
      let bestAbs = 999;
      FEATURES.forEach((_, i) => {
        const d = Math.abs(norm(angleRef.current + i * 45));
        if (d < bestAbs) {
          bestAbs = d;
          best = i;
        }
      });
      const near = bestAbs < 8;
      if (near && !wasNearRef.current && best !== lastShownRef.current) {
        lastShownRef.current = best;
        setCardHide(true);
        window.setTimeout(() => {
          setActiveFeature(best);
          setCardHide(false);
        }, 180);
      }
      wasNearRef.current = near;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (empHoldRef.current || document.hidden) return;
      setEmpIndex((i) => (i + 1) % EMP_STAGES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  const feature = FEATURES[activeFeature];
  const emp = EMP_STAGES[empIndex];

  return (
    <section className="day-orbit">
      <div className="day-orbit__page">
        <div className="day-orbit__bridge">
          <h2>
            One Platform. Two Journeys.
          </h2>
          <p className="day-orbit__tag">
            Empowering candidates to <span className="day-orbit__hi">grow</span> and employers to{' '}
            <span className="day-orbit__hi">hire</span> the best.
          </p>
          <div className="day-orbit__simple-row">
            <a href="#candidates" className="day-orbit__pill">
              Candidate
            </a>
            <i className="day-orbit__line" aria-hidden />
            <div className="day-orbit__hub">
              <b>
                CAREER
                <br />
                BRIDGE
              </b>
            </div>
            <i className="day-orbit__line" aria-hidden />
            <a href="#employers" className="day-orbit__pill">
              Employer
            </a>
          </div>
        </div>

        <header className="day-orbit__intro" id="candidates">
          <p className="day-orbit__k">For Candidates</p>
          <h3>Build Your Career. Not Just Your Resume.</h3>
          <p className="day-orbit__lead">
            Build your profile, improve your skills and discover the right opportunities.
          </p>
        </header>

        <div className="day-orbit__layout">
          <div className="day-orbit__stage" ref={stageRef}>
            <div className="day-orbit__halo" />
            <div className="day-orbit__orbit">
              {FEATURES.map((f, i) => {
                const r = stageW * 0.5 - 25;
                const cx = stageW / 2;
                const cy = stageW / 2;
                const a = ((angle + i * 45) * Math.PI) / 180;
                const x = cx + Math.cos(a) * r;
                const y = cy + Math.sin(a) * r;
                return (
                  <div
                    key={f.short}
                    className="day-orbit__item"
                    style={{ left: x, top: y }}
                  >
                    <button
                      type="button"
                      className={`day-orbit__chip${activeFeature === i ? ' is-active' : ''}`}
                      onClick={() => {
                        lastShownRef.current = i;
                        setCardHide(true);
                        window.setTimeout(() => {
                          setActiveFeature(i);
                          setCardHide(false);
                        }, 180);
                      }}
                    >
                      <span className="day-orbit__dot">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.img} alt="" />
                      </span>
                      <span>{f.short}</span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="day-orbit__core">Candidates</div>
          </div>

          <div className="day-orbit__dock">
            <article className={`day-orbit__card${cardHide ? ' is-hide' : ''}`}>
              <div className="day-orbit__pic">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={feature.img} alt="" />
              </div>
              <div className="day-orbit__copy">
                <h4>{feature.title}</h4>
                <p>{feature.body}</p>
                <p className="day-orbit__note">
                  Build your profile, improve your skills and discover the right opportunities.
                </p>
              </div>
            </article>
          </div>
        </div>

        <div className="day-orbit__cta-row">
          <Link href="/login?role=candidate" className="day-orbit__cta">
            Get Started as Candidate
          </Link>
        </div>

        <div className="day-orbit__emp" id="employers">
          <div className="day-orbit__emp-head">
            <div>
              <p className="day-orbit__k">For Employers</p>
              <h3>Hire Smarter. Spend Less Time Searching.</h3>
            </div>
            <p className="day-orbit__lead">
              Post requirements, find relevant talent and build high-performing teams.
            </p>
          </div>

          <div className="day-orbit__emp-wrap">
            <nav className="day-orbit__spine" aria-label="Employer journey">
              <i
                className="day-orbit__spine-fill"
                style={{ height: `${(empIndex / (EMP_STAGES.length - 1)) * 100}%` }}
              />
              {EMP_STAGES.map((stage, i) => {
                const labels = ['Requirement', 'Match', 'Shortlist', 'Interview', 'Hire'];
                return (
                <button
                  key={stage.n}
                  type="button"
                  className={`${i === empIndex ? 'is-on' : ''} ${i < empIndex ? 'is-done' : ''}`}
                  onClick={() => {
                    empHoldRef.current = true;
                    setEmpIndex(i);
                    window.setTimeout(() => {
                      empHoldRef.current = false;
                    }, 8000);
                  }}
                >
                  <small>{stage.n}</small>
                  {labels[i]}
                </button>
                );
              })}
            </nav>

            <div className="day-orbit__stage-view">
              <div className="day-orbit__emp-hero">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={emp.img} src={emp.img} alt="" />
                <div className="day-orbit__veil" />
              </div>
              <div className="day-orbit__meta">
                <div>
                  <div className="day-orbit__num">{emp.n}</div>
                  <h4>{emp.title}</h4>
                  <p>{emp.body}</p>
                </div>
                <div className="day-orbit__tiles">
                  {emp.extras.map(([a, b]) => (
                    <article key={a}>
                      <b>{a}</b>
                      <span>{b}</span>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="day-orbit__cta-row day-orbit__cta-row--emp">
            <Link href="/employer/welcome" className="day-orbit__cta day-orbit__cta--emp">
              Explore Employer Workspace
            </Link>
            <Link href="/employer/register" className="day-orbit__cta day-orbit__cta--emp-ghost">
              Post a job
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
