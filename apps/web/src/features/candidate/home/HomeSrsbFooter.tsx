'use client';

import Image from 'next/image';
import Link from 'next/link';

export function HomeSrsbFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="cb-home-srsb-footer" aria-label="SRSB CareerBridge">
      <div className="cb-home-srsb-footer__inner">
        <div className="cb-home-srsb-footer__brand">
          <Image
            src="/srsb-wordmark.png"
            alt="SRSB"
            width={408}
            height={170}
            className="cb-home-srsb-footer__logo"
            unoptimized
          />
          <p>
            SRSB CareerBridge — a free Career Passport for youth, and a hiring workspace for
            employers. Candidates never pay for core tools.
          </p>
        </div>

        <div className="cb-home-srsb-footer__col">
          <p className="cb-home-srsb-footer__label">Explore</p>
          <ul>
            <li>
              <Link href="/dashboard">My home</Link>
            </li>
            <li>
              <Link href="/passport?overview=1">Career Passport</Link>
            </li>
            <li>
              <Link href="/jobs">Jobs</Link>
            </li>
            <li>
              <Link href="/courses">Course suggestions</Link>
            </li>
          </ul>
        </div>

        <div className="cb-home-srsb-footer__col">
          <p className="cb-home-srsb-footer__label">Grow</p>
          <ul>
            <li>
              <Link href="/resume">Resume</Link>
            </li>
            <li>
              <Link href="/assessments">Skill assessment</Link>
            </li>
            <li>
              <Link href="/interviews">Mock interviews</Link>
            </li>
          </ul>
        </div>

        <div className="cb-home-srsb-footer__col">
          <p className="cb-home-srsb-footer__label">SRSB</p>
          <p className="cb-home-srsb-footer__note">
            Build your career. Build your future. Keep moving — one passport, one path.
          </p>
          <Link href="/dashboard" className="cb-home-srsb-footer__cta">
            Back to home
          </Link>
        </div>
      </div>

      <div className="cb-home-srsb-footer__bar">
        © {year} SRSB · CareerBridge · Candidates never pay for core tools
      </div>
    </footer>
  );
}
