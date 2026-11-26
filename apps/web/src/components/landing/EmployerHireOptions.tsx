'use client';

import Link from 'next/link';
import { EMPLOYER_SUPPORT_EMAIL } from '@careerbridge/shared';

const REGISTER_HREF = '/employer/register';
const RECRUIT_MAIL = `mailto:${EMPLOYER_SUPPORT_EMAIL}?subject=${encodeURIComponent('Managed hiring / recruitment services')}`;

const OPTIONS = [
  {
    id: 'self',
    label: 'Self-Service',
    labelTone: 'green' as const,
    title: 'Option 1: Career Bridge Platform',
    copy: 'Manage your recruitment independently through our platform.',
    features: [
      'Register your company',
      'Subscribe to a suitable plan',
      'Post jobs and access candidate profiles',
      'Manage your recruitment activities',
    ],
    cta: 'Register on Career Bridge',
    href: REGISTER_HREF,
    icon: 'monitor' as const,
  },
  {
    id: 'managed',
    label: 'Managed Hiring',
    labelTone: 'blue' as const,
    title: 'Option 2: Recruitment Services',
    copy: 'Let SRSB Workforce Solutions manage your hiring requirements.',
    features: [
      'Share your job requirements',
      'Get dedicated recruitment support',
      'Receive screened and shortlisted candidates',
      'Pay recruitment charges upon successful placement as agreed',
    ],
    cta: 'Connect With Recruitment Team',
    href: RECRUIT_MAIL,
    icon: 'people' as const,
  },
] as const;

function OptionIcon({ kind }: { kind: 'monitor' | 'people' }) {
  if (kind === 'monitor') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 20h8M12 18v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a6 6 0 0112 0M15 7a3.5 3.5 0 010 7M20 20a5 5 0 00-4-4.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Landing block: self-service + managed hiring, shown above pricing. */
export function EmployerHireOptions() {
  return (
    <section className="wl-hireopts" id="hire-options" aria-labelledby="wl-hireopts-title">
      <div className="wl-wrap">
        <div className="wl-hireopts__intro">
          <p className="wl-hireopts__kicker">How you can hire</p>
          <h2 id="wl-hireopts-title">Two ways to hire with SRSB</h2>
          <p>Self-service on Career Bridge, or fully managed recruitment — you choose.</p>
        </div>
        <div className="wl-hireopts__grid">
          {OPTIONS.map((opt, index) => (
            <article
              key={opt.id}
              className={`wl-hireopts__card wl-hireopts__card--${opt.id}`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="wl-hireopts__top">
                <span className="wl-hireopts__icon" aria-hidden>
                  <OptionIcon kind={opt.icon} />
                </span>
                <div className="wl-hireopts__titles">
                  <h3>{opt.title}</h3>
                  <span className={`wl-hireopts__badge wl-hireopts__badge--${opt.labelTone}`}>{opt.label}</span>
                </div>
              </div>
              <p className="wl-hireopts__copy">{opt.copy}</p>
              <ul>
                {opt.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {opt.href.startsWith('mailto:') ? (
                <a href={opt.href} className="wl-hireopts__cta">
                  {opt.cta}
                </a>
              ) : (
                <Link href={opt.href} className="wl-hireopts__cta">
                  {opt.cta}
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
