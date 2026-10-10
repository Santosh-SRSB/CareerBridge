import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import '@/components/landing/home/home-landing.css';
import '@/components/auth/auth-screen.css';

type AuthRole = 'candidate' | 'employer';
type AuthVariant = 'login' | 'register' | 'forgot' | 'verify';

const LEDE: Record<AuthVariant, Record<AuthRole, string>> = {
  login: {
    candidate: 'Sign in to continue your applications, saved roles, and messages.',
    employer: 'Sign in to manage openings, shortlists, and hiring conversations.',
  },
  register: {
    candidate: 'Register as a candidate to build your profile, apply to roles, and track every application.',
    employer: 'Register your company to post roles, review candidates, and hire with a verified work email.',
  },
  forgot: {
    candidate: 'Sign in to continue your applications, saved roles, and messages.',
    employer: 'Sign in to manage your openings and connect with the right talent.',
  },
  verify: {
    candidate: 'One quick check to confirm it is really you, then your candidate account is ready.',
    employer: 'One quick check to confirm it is really you, then your company account is ready.',
  },
};

const PORTRAIT: Record<AuthRole, { src: string; width: number; height: number }> = {
  candidate: { src: '/auth/welcome-candidate.png', width: 740, height: 494 },
  employer: { src: '/auth/welcome-employer.png', width: 612, height: 408 },
};

/**
 * Split layout for the login, registration, OTP verification and forgot-password screens: welcome panel on
 * the left, form panel on the right. Form behaviour lives entirely in the children.
 */
export function AuthScreen({
  variant,
  role,
  switchHref,
  backHref = '/',
  children,
}: {
  variant: AuthVariant;
  role: AuthRole;
  switchHref: string;
  backHref?: string;
  children: ReactNode;
}) {
  const who = role === 'employer' ? 'Employer' : 'Candidate';
  const portrait = PORTRAIT[role];

  return (
    <div className={`hl-page au-page au-page--${variant}`} data-role={role}>
      <aside className="au-hero">
        <div className="au-hero__copy" key={`${variant}-${role}`}>
          <div className="au-portrait">
            <Image src={portrait.src} alt="" width={portrait.width} height={portrait.height} priority />
          </div>
          <div className="au-logo">
            <Image src="/auth/srsb-logo-round.png" alt="SRSB" width={108} height={108} />
          </div>
          <span className="au-kicker">{who}</span>
          <p className="au-hero__title">Welcome, {who}</p>
          <p className="au-hero__lede">{LEDE[variant][role]}</p>
        </div>
      </aside>

      <main className="au-main">
        <Link href={backHref} className="au-back">
          ← Back
        </Link>
        <Link href={switchHref} className="au-switch">
          {variant === 'login' ? 'Register' : 'Sign in'}
        </Link>
        <div className="au-card">{children}</div>
      </main>

      <div
        id="recaptcha-container"
        style={{
          position: 'fixed',
          left: '-9999px',
          bottom: 0,
          width: 1,
          height: 1,
          opacity: 0,
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
