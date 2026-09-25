'use client';

import Image from 'next/image';
import Link from 'next/link';

type WelcomeRole = 'candidate' | 'employer';

const SOCIAL = {
  facebook: 'https://www.facebook.com/srsbworkforce',
  instagram: 'https://www.instagram.com/srsbworkforce/',
  linkedin: 'https://www.linkedin.com/company/109188021/',
  email: 'mailto:Srsbhr25@gmail.com',
} as const;

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M14 8h3V4h-3c-2.2 0-4 1.8-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8c0-.6.4-1 1-1z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLinkedIn() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M6.5 9.5H3.7V20h2.8V9.5zM5.1 4A1.65 1.65 0 1 0 5.1 7.3 1.65 1.65 0 0 0 5.1 4zM20.3 20h-2.8v-5.5c0-1.5-.5-2.5-1.8-2.5-1 0-1.5.7-1.7 1.3-.1.2-.1.6-.1.9V20h-2.8s.1-9.3 0-10.5h2.8v1.7c.4-.7 1.2-1.9 3.1-1.9 2.2 0 3.9 1.5 3.9 4.7V20z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  );
}

export function WelcomeRoleNav({ role }: { role: WelcomeRole }) {
  const loginHref = role === 'candidate' ? '/login?role=candidate' : '/login?role=employer';
  const signupHref = role === 'candidate' ? '/register?role=candidate' : '/employer/register';
  const brandHref = role === 'candidate' ? '/welcome' : '/employer/welcome';

  return (
    <nav className="welcome-nav" aria-label="Primary">
      <div className="welcome-nav__bar">
        <Link className="welcome-nav__brand" href={brandHref}>
          <Image
            src="/srsb-mark.png"
            alt="SRSB"
            width={160}
            height={48}
            className="welcome-nav__mark"
            unoptimized
            priority
          />
          <span className="welcome-nav__word">Career Bridge</span>
        </Link>

        <div className="welcome-nav__center">
          <Link className="welcome-nav__home" href="/">
            Home
          </Link>
          <div className="welcome-nav__switch" role="tablist" aria-label="Audience">
            <Link
              className={role === 'candidate' ? 'on' : undefined}
              href="/welcome"
              role="tab"
              aria-selected={role === 'candidate'}
            >
              Candidates
            </Link>
            <Link
              className={role === 'employer' ? 'on' : undefined}
              href="/employer/welcome"
              role="tab"
              aria-selected={role === 'employer'}
            >
              Employers
            </Link>
          </div>
        </div>

        <div className="welcome-nav__auth">
          <a className="welcome-nav__email" href={SOCIAL.email}>
            Srsbhr25@gmail.com
          </a>
          <i aria-hidden="true" />
          <Link href={loginHref}>Login</Link>
          <i aria-hidden="true" />
          <Link href={signupHref}>Signup</Link>
        </div>
      </div>
    </nav>
  );
}

export function WelcomeFoot({ role }: { role: WelcomeRole }) {
  return (
    <footer className="welcome-foot">
      <div className="welcome-foot__main">
        <Link href="/" className="welcome-foot__logo" aria-label="SRSB Career Bridge">
          <Image
            src="/srsb-mark.png"
            alt="SRSB Career Bridge"
            width={200}
            height={72}
            className="welcome-foot__logo-img"
            unoptimized
          />
        </Link>
        <div>
          <h4>Candidate</h4>
          <Link href="/login?role=candidate">Candidate Login</Link>
          <Link href={role === 'candidate' ? '#features' : '/welcome#features'}>
            Candidate Features
          </Link>
        </div>
        <div>
          <h4>Employer</h4>
          <Link href="/login?role=employer">Employer Login</Link>
          <Link href={role === 'employer' ? '#features' : '/employer/welcome#features'}>
            Employer Features
          </Link>
        </div>
        <div>
          <h4>Links</h4>
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy and Policy</Link>
          <Link href="/terms">Terms and Conditions</Link>
          <a href={SOCIAL.email}>Srsbhr25@gmail.com</a>
        </div>
      </div>
      <div className="welcome-foot__socials">
        <a href={SOCIAL.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
          <IconFacebook />
        </a>
        <a href={SOCIAL.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
          <IconInstagram />
        </a>
        <a href={SOCIAL.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
          <IconLinkedIn />
        </a>
        <a href={SOCIAL.email} aria-label="Email SRSB">
          <IconMail />
        </a>
      </div>
      <p className="welcome-foot__copy">
        © {new Date().getFullYear()} CareerBridge. All rights reserved.
      </p>
    </footer>
  );
}
