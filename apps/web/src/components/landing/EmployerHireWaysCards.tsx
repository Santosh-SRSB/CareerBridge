'use client';

import Link from 'next/link';
import { EMPLOYER_SUPPORT_EMAIL } from '@careerbridge/shared';

export const HIRE_REGISTER_HREF = '/employer/register';
export const HIRE_RECRUIT_MAIL = `mailto:${EMPLOYER_SUPPORT_EMAIL}?subject=${encodeURIComponent('Managed hiring / recruitment services')}`;

const CARDS = [
  {
    id: 'self',
    option: 'Option 1',
    title: 'Career Bridge Platform',
    badge: 'Self-Service',
    badgeTone: 'green' as const,
    iconTone: 'teal' as const,
    copy: 'Manage your recruitment independently through our platform.',
    features: [
      'Register your company',
      'Subscribe to a suitable plan',
      'Post jobs and access candidate profiles',
      'Manage your recruitment activities',
    ],
    price: '₹999',
    priceHint: 'Plans from · 30 days, 3 or 6 months',
    cta: 'Register on Career Bridge',
    href: HIRE_REGISTER_HREF,
    ctaTone: 'navy' as const,
    icon: 'monitor' as const,
  },
  {
    id: 'managed',
    option: 'Option 2',
    title: 'Recruitment Services',
    badge: 'Managed Hiring',
    badgeTone: 'blue' as const,
    iconTone: 'amber' as const,
    copy: 'Let SRSB Workforce Solutions manage your hiring requirements.',
    features: [
      'Share your job requirements',
      'Get dedicated recruitment support',
      'Receive screened and shortlisted candidates',
      'Pay recruitment charges upon successful placement as agreed',
    ],
    price: '5% – 8.33% of CTC',
    priceHint: 'Success fee, paid on placement',
    cta: 'Connect With Recruitment Team',
    href: HIRE_RECRUIT_MAIL,
    ctaTone: 'amber' as const,
    icon: 'people' as const,
  },
] as const;

function CardIcon({ kind }: { kind: 'monitor' | 'people' }) {
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

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  /** Extra class on the grid wrapper */
  className?: string;
  onNavigate?: () => void;
};

/** Light “Two ways to hire” cards — shared by popup + landing section. */
export function EmployerHireWaysCards({ className, onNavigate }: Props) {
  return (
    <div className={`cb-hire-light__grid${className ? ` ${className}` : ''}`}>
      {CARDS.map((card) => {
        const ctaClass = `cb-hire-light__cta cb-hire-light__cta--${card.ctaTone}`;
        const inner = (
          <>
            {card.cta}
            <ArrowIcon />
          </>
        );
        return (
          <article key={card.id} className={`cb-hire-light__card cb-hire-light__card--${card.id}`}>
            <div className="cb-hire-light__top">
              <span className={`cb-hire-light__icon cb-hire-light__icon--${card.iconTone}`} aria-hidden>
                <CardIcon kind={card.icon} />
              </span>
              <div className="cb-hire-light__meta">
                <p className="cb-hire-light__option">{card.option}</p>
                <div className="cb-hire-light__title-row">
                  <h3>{card.title}</h3>
                  <span className={`cb-hire-light__badge cb-hire-light__badge--${card.badgeTone}`}>{card.badge}</span>
                </div>
              </div>
            </div>
            <p className="cb-hire-light__copy">{card.copy}</p>
            <ul>
              {card.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <div className="cb-hire-light__price">
              <b>{card.price}</b>
              <span>{card.priceHint}</span>
            </div>
            {card.href.startsWith('mailto:') ? (
              <a href={card.href} className={ctaClass} onClick={onNavigate}>
                {inner}
              </a>
            ) : (
              <Link href={card.href} className={ctaClass} onClick={onNavigate}>
                {inner}
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
