'use client';

import Link from 'next/link';

type WelcomeRole = 'candidate' | 'employer';

export function WelcomeRoleNav({ role }: { role: WelcomeRole }) {
  const loginHref = role === 'candidate' ? '/login?role=candidate' : '/login?role=employer';
  const signupHref = role === 'candidate' ? '/register?role=candidate' : '/employer/register';

  return (
    <nav className="welcome-nav" aria-label="Primary">
      <div className="welcome-nav__bar">
        <Link
          className="welcome-nav__logo"
          href={role === 'candidate' ? '/welcome' : '/employer/welcome'}
        >
          CareerBridge
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
        <div className="welcome-nav__auth">
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
        <div className="welcome-foot__logo">
          Career
          <br />
          Bridge
        </div>
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
        </div>
      </div>
      <div className="welcome-foot__socials">
        <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
          in
        </a>
        <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X">
          X
        </a>
        <a href="mailto:hello@careerbridge.com" aria-label="Email">
          @
        </a>
        <a
          href="https://www.instagram.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
        >
          Ig
        </a>
        <a href="https://www.facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
          f
        </a>
      </div>
      <p className="welcome-foot__copy">
        © {new Date().getFullYear()} CareerBridge. All rights reserved.
      </p>
    </footer>
  );
}
