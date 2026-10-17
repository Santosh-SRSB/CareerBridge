'use client';

import { useRouter } from 'next/navigation';

export function HomeInterviewSection() {
  const router = useRouter();

  return (
    <section className="cb-home-interview-hero" aria-labelledby="home-interview-title">
      <aside className="cb-home-interview-hero__aside" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascots/srsb-eagle-final-cut.png"
          alt=""
          className="cb-home-interview-hero__mascot"
        />
      </aside>

      <div className="cb-home-interview-stage" aria-hidden="true">
        <div className="cb-home-interview-stage__card">
          <span className="cb-home-interview-stage__dot" />
          <span className="cb-home-interview-stage__dot" />
          <span className="cb-home-interview-stage__dot" />
          <div className="cb-home-interview-stage__screen">
            <span className="cb-home-interview-stage__wave" />
            <span className="cb-home-interview-stage__wave" />
            <span className="cb-home-interview-stage__wave" />
          </div>
          <p className="cb-home-interview-stage__label">Mock live</p>
        </div>
      </div>

      <div className="cb-home-interview-hero__copy">
        <p className="cb-home-interview-hero__kicker">Interview</p>
        <h2 id="home-interview-title" className="cb-home-interview-hero__title">
          Skills get you shortlisted.
          <span className="cb-home-interview-hero__break">
            A{' '}
            <em className="cb-home-interview-hero__mark">confident interview</em>{' '}
            gets you hired.
          </span>
        </h2>
        <p className="cb-home-interview-hero__lead">
          Practice real questions, get a score, and walk into your next interview with less stress
          and clearer answers.
        </p>
        <div className="cb-home-interview-hero__actions">
          <button
            type="button"
            className="cb-home-btn cb-home-btn--interview"
            onClick={() => router.push('/interviews')}
          >
            Start mock interview
          </button>
          <button
            type="button"
            className="cb-home-btn cb-home-btn--outline"
            onClick={() => router.push('/interviews')}
          >
            View practice
          </button>
        </div>
      </div>
    </section>
  );
}
