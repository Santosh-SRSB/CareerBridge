'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  EMPLOYER_SUBSCRIPTION_PLANS,
  EMPLOYER_SUPPORT_EMAIL,
  getEmployerSubscriptionPlan,
  type EmployerSubscriptionPlan,
  type EmployerSubscriptionPlanId,
} from '@careerbridge/shared';
import { storeEmployerPlanId } from '@/lib/employer-plan-gate';
import './employer-pricing.css';

const TRACK =
  'HIRE SMARTER ✦ POST JOBS ✦ FIND TALENT ✦ SRSB CAREERBRIDGE ✦ '.repeat(6);

const FLOAT_SHAPES = [
  '<path d="M12 2l2.600 6.600L21 10l-5 4.500L17.500 22 12 18.500 6.500 22 8 14.500 3 10l6.400-1.400z" fill="#FBBF24"/>',
  '<circle cx="12" cy="12" r="8" fill="none" stroke="#7C83FF" stroke-width="3"/>',
  '<path d="M12 4v16M4 12h16" stroke="#34D399" stroke-width="3" stroke-linecap="round"/>',
  '<rect x="5" y="5" width="14" height="14" rx="3" fill="#F472B6"/>',
];

const BIT_COLORS = ['#FBBF24', '#34D399', '#7C83FF', '#F472B6', '#fff'];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2l2.3 2.3 4.7-5"
        stroke="currentColor"
        strokeWidth="1.9"
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

function Mascot({ id }: { id: EmployerSubscriptionPlanId }) {
  if (id === 'starter') {
    return (
      <svg className="cb-price__mascot" viewBox="0 0 100 100" aria-hidden>
        <path d="M38 38v-9a6 6 0 016-6h12a6 6 0 016 6v9" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <rect x="16" y="36" width="68" height="50" rx="12" fill="#7C83FF" />
        <rect x="16" y="60" width="68" height="7" fill="#5A61E0" />
        <circle cx="50" cy="63" r="5" fill="#FBBF24" />
        <g className="cb-price__eye">
          <circle cx="37" cy="50" r="6" fill="#fff" />
          <circle cx="63" cy="50" r="6" fill="#fff" />
          <circle cx="38" cy="51" r="3" fill="#0C1245" />
          <circle cx="64" cy="51" r="3" fill="#0C1245" />
        </g>
        <path d="M42 74q8 8 16 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="28" cy="62" r="4" fill="#F9A8D4" opacity=".7" />
        <circle cx="72" cy="62" r="4" fill="#F9A8D4" opacity=".7" />
      </svg>
    );
  }
  if (id === 'growth') {
    return (
      <svg className="cb-price__mascot" viewBox="0 0 100 100" aria-hidden>
        <path d="M42 76Q50 100 58 76Z" className="cb-price__flame" fill="#FB923C" />
        <path d="M44 76Q50 90 56 76Z" className="cb-price__flame" fill="#FDE68A" />
        <path d="M36 58L18 80L36 74Z" fill="#FBBF24" />
        <path d="M64 58L82 80L64 74Z" fill="#FBBF24" />
        <path d="M50 6C70 22 72 52 65 76H35C28 52 30 22 50 6Z" fill="#fff" />
        <path d="M50 6C58 12 63 19 66 27H34C37 19 42 12 50 6Z" fill="#F87171" />
        <circle cx="50" cy="44" r="13" fill="#1D2688" stroke="#FBBF24" strokeWidth="3" />
        <g className="cb-price__eye">
          <circle cx="45" cy="42" r="2.6" fill="#FDE68A" />
          <circle cx="55" cy="42" r="2.6" fill="#FDE68A" />
        </g>
        <path d="M45 49q5 5 10 0" fill="none" stroke="#FDE68A" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'business') {
    return (
      <svg className="cb-price__mascot" viewBox="0 0 100 100" aria-hidden>
        <path d="M8 90q18-34 36 0z" fill="#FBBF24" />
        <path d="M56 90q18-34 36 0z" fill="#F472B6" />
        <path d="M32 90q18-38 36 0z" fill="#34D399" />
        <circle cx="26" cy="58" r="12" fill="#FDE68A" />
        <circle cx="74" cy="58" r="12" fill="#FBCFE8" />
        <circle cx="50" cy="46" r="14" fill="#A7F3D0" />
        <g className="cb-price__eye">
          <circle cx="46" cy="44" r="2" fill="#0C1245" />
          <circle cx="54" cy="44" r="2" fill="#0C1245" />
        </g>
        <g className="cb-price__eye">
          <circle cx="22" cy="56" r="1.7" fill="#0C1245" />
          <circle cx="30" cy="56" r="1.7" fill="#0C1245" />
        </g>
        <g className="cb-price__eye">
          <circle cx="70" cy="56" r="1.7" fill="#0C1245" />
          <circle cx="78" cy="56" r="1.7" fill="#0C1245" />
        </g>
        <path d="M45 51q5 5 10 0M22 62q4 4 8 0M70 62q4 4 8 0" fill="none" stroke="#0C1245" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'staffing') {
    return (
      <svg className="cb-price__mascot" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="38" fill="#312E81" />
        <circle cx="38" cy="42" r="12" fill="#A5B4FC" />
        <circle cx="62" cy="42" r="12" fill="#C4B5FD" />
        <path d="M22 72c4-14 14-20 28-20s24 6 28 20" fill="#6366F1" />
        <g className="cb-price__eye">
          <circle cx="35" cy="41" r="2.2" fill="#0C1245" />
          <circle cx="41" cy="41" r="2.2" fill="#0C1245" />
        </g>
        <g className="cb-price__eye">
          <circle cx="59" cy="41" r="2.2" fill="#0C1245" />
          <circle cx="65" cy="41" r="2.2" fill="#0C1245" />
        </g>
        <path d="M34 48q4 4 8 0M58 48q4 4 8 0" fill="none" stroke="#0C1245" strokeWidth="2" strokeLinecap="round" />
        <circle cx="50" cy="78" r="6" fill="#34D399" />
        <path d="M47 78l2 2 4-4" fill="none" stroke="#0C1245" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="cb-price__mascot" viewBox="0 0 100 100" aria-hidden>
      <path d="M30 24l6-14 14 9 14-9 6 14z" fill="#FBBF24" />
      <rect x="28" y="24" width="44" height="64" rx="7" fill="#A78BFA" />
      <g fill="#FDE68A">
        <rect className="cb-price__win" x="35" y="32" width="9" height="8" rx="2" />
        <rect className="cb-price__win" x="56" y="32" width="9" height="8" rx="2" style={{ animationDelay: '.8s' }} />
        <rect className="cb-price__win" x="35" y="46" width="9" height="8" rx="2" style={{ animationDelay: '1.5s' }} />
        <rect className="cb-price__win" x="56" y="46" width="9" height="8" rx="2" style={{ animationDelay: '.4s' }} />
      </g>
      <g className="cb-price__eye">
        <circle cx="43" cy="66" r="3" fill="#0C1245" />
        <circle cx="57" cy="66" r="3" fill="#0C1245" />
      </g>
      <path d="M44 74q6 6 12 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <rect x="22" y="86" width="56" height="5" rx="2.5" fill="#7C3AED" />
    </svg>
  );
}

function burst(e: { clientX: number; clientY: number }) {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 26; i += 1) {
    const d = document.createElement('i');
    d.className = 'cb-price__bit';
    d.style.background = BIT_COLORS[i % 5];
    d.style.left = `${e.clientX}px`;
    d.style.top = `${e.clientY}px`;
    document.body.appendChild(d);
    const a = Math.random() * 6.28;
    const v = 60 + Math.random() * 120;
    d.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        {
          transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v + 80}px) rotate(${Math.random() * 540}deg)`,
          opacity: 0,
        },
      ],
      { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' },
    ).onfinish = () => d.remove();
  }
}

export type EmployerPricingPlansProps = {
  /** When true, paid plan CTAs call onSelectPlan instead of sending users to login. */
  signedIn?: boolean;
  initialPlanId?: string | null;
  onSelectPlan?: (plan: EmployerSubscriptionPlan) => void;
  /** Override href after selecting a paid plan while signed in. */
  continueHref?: (plan: EmployerSubscriptionPlan) => string;
  compactRails?: boolean;
};

export function EmployerPricingPlans({
  signedIn = false,
  initialPlanId = null,
  onSelectPlan,
  continueHref,
  compactRails = false,
}: EmployerPricingPlansProps) {
  const [selectedId, setSelectedId] = useState<EmployerSubscriptionPlanId | null>(
    () => getEmployerSubscriptionPlan(initialPlanId)?.id ?? null,
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const floaters = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 96}%`,
        top: `${Math.random() * 95}%`,
        width: `${16 + Math.random() * 22}px`,
        d: `${6 + Math.random() * 7}s`,
        delay: `-${Math.random() * 6}s`,
        shape: FLOAT_SHAPES[i % 4],
      })),
    [],
  );

  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.cb-price__card'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    cards.forEach((card) => io.observe(card));
    return () => io.disconnect();
  }, []);

  const selected = selectedId ? getEmployerSubscriptionPlan(selectedId) : undefined;

  function handlePlanClick(plan: EmployerSubscriptionPlan, e: { clientX: number; clientY: number }) {
    burst(e);
    if (plan.contactSales) return;
    setSelectedId(plan.id);
    storeEmployerPlanId(plan.id);
    onSelectPlan?.(plan);
  }

  function ctaHref(plan: EmployerSubscriptionPlan) {
    if (plan.contactSales) return `mailto:${EMPLOYER_SUPPORT_EMAIL}`;
    if (continueHref) return continueHref(plan);
    if (signedIn) return `/employer/payments/buy?plan=${plan.id}`;
    return `/login?role=employer&plan=${plan.id}`;
  }

  return (
    <div className="cb-price">
      {!compactRails ? (
        <>
          <div className="cb-price__rail cb-price__rail--l" aria-hidden>
            <span className="cb-price__track">{TRACK}</span>
          </div>
          <div className="cb-price__rail cb-price__rail--r" aria-hidden>
            <span className="cb-price__track">{TRACK}</span>
          </div>
        </>
      ) : null}
      <div className="cb-price__glow cb-price__glow--1" aria-hidden />
      <div className="cb-price__glow cb-price__glow--2" aria-hidden />
      <div aria-hidden>
        {floaters.map((f) => (
          <div
            key={f.id}
            className="cb-price__fl"
            style={
              {
                left: f.left,
                top: f.top,
                width: f.width,
                '--d': f.d,
                animationDelay: f.delay,
              } as CSSProperties
            }
            dangerouslySetInnerHTML={{
              __html: `<svg viewBox="0 0 24 24" width="100%" aria-hidden="true">${f.shape}</svg>`,
            }}
          />
        ))}
      </div>

      <div className="cb-price__inner">
        <header className="cb-price__header">
          <div className="cb-price__coin" aria-hidden>
            <div>₹</div>
          </div>
          <span className="cb-price__free">★ 1 MONTH FREE TO START</span>
          <h1 className="cb-price__title">
            Clear plans. <em>No surprises.</em>
          </h1>
          <p className="cb-price__sub">
            Choose Starter, Growth, Business, Staffing &amp; On-Roll or Enterprise. Job posts, login seats, database
            views and support scale with each plan. Self-serve prices are exclusive of GST; checkout adds 18% GST.
          </p>
        </header>

        <div className="cb-price__grid" id="grid" ref={gridRef}>
          {EMPLOYER_SUBSCRIPTION_PLANS.map((plan, i) => {
            const href = ctaHref(plan);
            const isLink = plan.contactSales || !signedIn || !onSelectPlan;
            const style = { transitionDelay: `${i * 110}ms` } as CSSProperties;
            return (
              <section
                key={plan.id}
                className={`cb-price__card${plan.recommended ? ' is-hot' : ''}${plan.id === 'staffing' ? ' is-staffing' : ''}`}
                style={style}
                onPointerMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
                  e.currentTarget.style.setProperty('--rx', `${-(((e.clientY - r.top) / r.height - 0.5) * 8)}deg`);
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.setProperty('--rx', '0deg');
                  e.currentTarget.style.setProperty('--ry', '0deg');
                }}
              >
                {plan.recommended ? <span className="cb-price__badge">RECOMMENDED</span> : null}
                {plan.id === 'staffing' ? <span className="cb-price__badge cb-price__badge--new">NEW</span> : null}
                <Mascot id={plan.id} />
                <h3>{plan.name}</h3>
                <p className="cb-price__tag">{plan.tagline}</p>
                <div className="cb-price__amount">
                  <b>{plan.priceLabel}</b>
                  {plan.periodLabel ? <span>{plan.periodLabel}</span> : null}
                  <small>{plan.priceHint || '\u00A0'}</small>
                </div>
                <ul className="cb-price__features">
                  {plan.features.map((feature, j) => (
                    <li key={feature} style={{ transitionDelay: `${350 + i * 110 + j * 70}ms` }}>
                      <span className="cb-price__ck">
                        <CheckIcon />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.contactSales ? (
                  <div className="cb-price__mail">
                    Talk with us for this plan
                    <a href={`mailto:${EMPLOYER_SUPPORT_EMAIL}`}>{EMPLOYER_SUPPORT_EMAIL}</a>
                  </div>
                ) : null}
                {isLink ? (
                  <Link
                    className="cb-price__btn"
                    href={href}
                    onClick={(e: { clientX: number; clientY: number }) => handlePlanClick(plan, e)}
                  >
                    {plan.cta}
                    <ArrowIcon />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="cb-price__btn"
                    onClick={(e: { clientX: number; clientY: number }) => handlePlanClick(plan, e)}
                  >
                    {plan.cta}
                    <ArrowIcon />
                  </button>
                )}
              </section>
            );
          })}
        </div>

        {signedIn && !onSelectPlan && selected && !selected.contactSales ? (
          <div className="cb-price__selected" role="status">
            <h2>
              Selected: {selected.name} · {selected.priceLabel}
              {selected.periodLabel}
            </h2>
            <p>
              Confirm this plan to continue to secure Razorpay checkout. Amount is set by the server.
            </p>
            <Link
              className="cb-price__btn"
              href={continueHref?.(selected) ?? `/employer/payments/buy?plan=${selected.id}`}
              style={{ maxWidth: 320, margin: '0 auto' }}
              onClick={() => storeEmployerPlanId(selected.id)}
            >
              Continue with {selected.name}
              <ArrowIcon />
            </Link>
          </div>
        ) : null}

        <p className="cb-price__note">
          Not sure which plan fits? Write to{' '}
          <a href={`mailto:${EMPLOYER_SUPPORT_EMAIL}`}>{EMPLOYER_SUPPORT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
