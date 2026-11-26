'use client';

import Link from 'next/link';

/** Both CTAs scroll to employer plans on the welcome page. */
export const HIRE_PLANS_HREF = '#plans';

const CARDS = [
  {
    id: 'self',
    option: 'Option 1',
    title: 'Career Bridge Platform',
    badge: 'Self-Service',
    badgeTone: 'green' as const,
    copy: 'Manage your recruitment independently through our platform.',
    features: [
      'Register your company',
      'Subscribe to a suitable plan',
      'Post jobs and access candidate profiles',
      'Manage your recruitment activities',
    ],
    cta: 'View plans',
    ctaTone: 'navy' as const,
  },
  {
    id: 'managed',
    option: 'Option 2',
    title: 'Recruitment Services',
    badge: 'Managed Hiring',
    badgeTone: 'blue' as const,
    copy: 'Let SRSB Workforce Solutions manage your hiring requirements.',
    features: [
      'Share your job requirements',
      'Get dedicated recruitment support',
      'Receive screened and shortlisted candidates',
      'Pay recruitment charges upon successful placement as agreed',
    ],
    cta: 'View plans',
    ctaTone: 'amber' as const,
  },
] as const;

function SelfMascot() {
  return (
    <svg className="cb-hire-light__mascot" viewBox="0 0 120 100" aria-hidden>
      <ellipse cx="60" cy="92" rx="34" ry="6" fill="rgba(15,23,42,0.08)" />
      <rect x="28" y="28" width="64" height="48" rx="12" fill="#7C83FF" />
      <rect x="28" y="52" width="64" height="8" fill="#5A61E0" />
      <circle cx="60" cy="56" r="5" fill="#FBBF24" />
      <g className="cb-hire-light__eye">
        <circle cx="46" cy="44" r="7" fill="#fff" />
        <circle cx="74" cy="44" r="7" fill="#fff" />
        <circle cx="48" cy="45" r="3.2" fill="#0C1245" />
        <circle cx="76" cy="45" r="3.2" fill="#0C1245" />
      </g>
      <path d="M50 66q10 10 20 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="38" cy="58" r="4" fill="#F9A8D4" opacity=".75" />
      <circle cx="82" cy="58" r="4" fill="#F9A8D4" opacity=".75" />
      <path d="M44 28v-8a8 8 0 018-8h16a8 8 0 018 8v8" fill="none" stroke="#0C1245" strokeWidth="4" strokeLinecap="round" />
      <circle className="cb-hire-light__spark" cx="18" cy="22" r="3" fill="#FBBF24" />
      <circle className="cb-hire-light__spark cb-hire-light__spark--b" cx="102" cy="18" r="2.5" fill="#34D399" />
    </svg>
  );
}

function ManagedMascot() {
  return (
    <svg className="cb-hire-light__mascot" viewBox="0 0 120 100" aria-hidden>
      <ellipse cx="60" cy="92" rx="34" ry="6" fill="rgba(15,23,42,0.08)" />
      <circle cx="44" cy="40" r="16" fill="#A5B4FC" />
      <circle cx="76" cy="40" r="16" fill="#FDBA74" />
      <path d="M22 78c6-18 18-26 38-26s32 8 38 26" fill="#6366F1" />
      <g className="cb-hire-light__eye">
        <circle cx="40" cy="38" r="2.4" fill="#0C1245" />
        <circle cx="48" cy="38" r="2.4" fill="#0C1245" />
        <circle cx="72" cy="38" r="2.4" fill="#0C1245" />
        <circle cx="80" cy="38" r="2.4" fill="#0C1245" />
      </g>
      <path d="M38 46q6 6 12 0M70 46q6 6 12 0" fill="none" stroke="#0C1245" strokeWidth="2.2" strokeLinecap="round" />
      <circle className="cb-hire-light__spark" cx="20" cy="20" r="3" fill="#FBBF24" />
      <path className="cb-hire-light__spark cb-hire-light__spark--b" d="M98 16l2.2 5.2 5.4.6-4 4.2 1.2 5.4-4.8-2.8-4.8 2.8 1.2-5.4-4-4.2 5.4-.6z" fill="#34D399" />
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
  className?: string;
  onNavigate?: () => void;
};

/** Light “Two ways to hire” cards — shared by popup + landing section. */
export function EmployerHireWaysCards({ className, onNavigate }: Props) {
  return (
    <div className={`cb-hire-light__grid${className ? ` ${className}` : ''}`}>
      {CARDS.map((card, index) => {
        const ctaClass = `cb-hire-light__cta cb-hire-light__cta--${card.ctaTone}`;
        return (
          <article
            key={card.id}
            className={`cb-hire-light__card cb-hire-light__card--${card.id}`}
            style={{ animationDelay: `${120 + index * 110}ms` }}
          >
            <div className="cb-hire-light__art" aria-hidden>
              {card.id === 'self' ? <SelfMascot /> : <ManagedMascot />}
            </div>
            <div className="cb-hire-light__meta">
              <p className="cb-hire-light__option">{card.option}</p>
              <div className="cb-hire-light__title-row">
                <h3>{card.title}</h3>
                <span className={`cb-hire-light__badge cb-hire-light__badge--${card.badgeTone}`}>{card.badge}</span>
              </div>
            </div>
            <p className="cb-hire-light__copy">{card.copy}</p>
            <ul>
              {card.features.map((feature, i) => (
                <li key={feature} style={{ animationDelay: `${280 + index * 110 + i * 70}ms` }}>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href={HIRE_PLANS_HREF}
              className={ctaClass}
              onClick={() => {
                onNavigate?.();
              }}
            >
              {card.cta}
              <ArrowIcon />
            </Link>
          </article>
        );
      })}
    </div>
  );
}
