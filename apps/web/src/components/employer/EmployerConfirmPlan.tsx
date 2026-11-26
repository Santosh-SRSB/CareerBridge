'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import Link from 'next/link';
import {
  EMPLOYER_SUPPORT_EMAIL,
  computeSubscriptionGst,
  formatInrFromPaise,
  getEmployerSubscriptionPlan,
  type EmployerSubscriptionPlan,
  type EmployerSubscriptionPlanId,
} from '@careerbridge/shared';
import './employer-confirm-plan.css';

const CONFIRM_PLAN_IDS = ['starter', 'growth', 'business'] as const;
type ConfirmPlanId = (typeof CONFIRM_PLAN_IDS)[number];

const BIT_COLORS = ['#FBBF24', '#34D399', '#7C83FF', '#F472B6', '#fff'];

const PILL_FEATURES: Record<ConfirmPlanId, string[]> = {
  starter: ['Applicant management', 'Basic candidate filters', 'Email support'],
  growth: ['Applicant management', 'Advanced candidate filters', 'Candidate shortlist', 'Priority email support'],
  business: [
    'Advanced candidate filters',
    'Candidate shortlist and tracking',
    'Priority support',
    'Job performance reports',
  ],
};

function isConfirmPlanId(id: string | null | undefined): id is ConfirmPlanId {
  return CONFIRM_PLAN_IDS.includes(id as ConfirmPlanId);
}

function validityLabel(plan: EmployerSubscriptionPlan) {
  if (plan.durationDays === 30) return '30 days';
  if (plan.durationDays === 90) return '3 months';
  if (plan.durationDays === 180) return '6 months';
  return plan.periodLabel.replace(/^\//, '').trim() || 'Custom';
}

function shortTagline(plan: EmployerSubscriptionPlan) {
  const parts = plan.tagline.split('·').map((s) => s.trim());
  return parts.length > 1 ? parts.slice(1).join(' · ') : plan.tagline;
}

function formatInrWhole(paise: number | null) {
  if (paise == null) return 'Custom';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

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

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}

function BrandMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/srsb-logo.png" alt="" width={28} height={28} className="cb-planx__mark-img" />
  );
}

function Mascot({ id }: { id: ConfirmPlanId }) {
  if (id === 'starter') {
    return (
      <svg className="cb-planx__mascot" viewBox="0 0 120 120" aria-hidden>
        <path className="cb-planx__tw" d="M104 20l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#FDE68A" />
        <path className="cb-planx__tw" style={{ animationDelay: '.9s' }} d="M14 30l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" fill="#fff" />
        <path d="M44 44v-9a7 7 0 017-7h18a7 7 0 017 7v9" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <rect x="18" y="42" width="84" height="62" rx="16" fill="#7C83FF" />
        <path d="M18 70h84v6H18z" fill="#5A61E0" />
        <rect x="52" y="64" width="16" height="18" rx="4" fill="#FBBF24" />
        <circle cx="60" cy="73" r="2.4" fill="#0C1245" />
        <g className="cb-planx__eye">
          <circle cx="52" cy="56" r="4.6" fill="#fff" />
          <circle cx="68" cy="56" r="4.6" fill="#fff" />
          <circle cx="53" cy="57" r="2.4" fill="#0C1245" />
          <circle cx="69" cy="57" r="2.4" fill="#0C1245" />
        </g>
        <path d="M55 65q5 6 10 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="45" cy="63" r="3.4" fill="#F9A8D4" opacity=".75" />
        <circle cx="75" cy="63" r="3.4" fill="#F9A8D4" opacity=".75" />
        <path d="M26 50q4-4 12-4" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'growth') {
    return (
      <svg className="cb-planx__mascot" viewBox="0 0 120 120" aria-hidden>
        <path className="cb-planx__tw" d="M104 20l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#FDE68A" />
        <path className="cb-planx__flame" d="M50 92Q60 118 70 92Z" fill="#FB923C" />
        <path className="cb-planx__flame" d="M54 92Q60 106 66 92Z" fill="#FDE68A" />
        <path d="M42 66L22 94L44 86Z" fill="#FBBF24" />
        <path d="M78 66L98 94L76 86Z" fill="#FBBF24" />
        <path d="M60 8C84 26 88 64 78 92H42C32 64 36 26 60 8Z" fill="#fff" />
        <path d="M60 8C70 15 77 24 80 34H40C43 24 50 15 60 8Z" fill="#F87171" />
        <circle cx="60" cy="56" r="17" fill="#1D2688" stroke="#FBBF24" strokeWidth="4" />
        <g className="cb-planx__eye">
          <circle cx="54" cy="54" r="4.6" fill="#FDE68A" />
          <circle cx="66" cy="54" r="4.6" fill="#FDE68A" />
          <circle cx="55" cy="55" r="2.4" fill="#0C1245" />
          <circle cx="67" cy="55" r="2.4" fill="#0C1245" />
        </g>
        <path d="M55 63q5 6 10 0" fill="none" stroke="#FDE68A" strokeWidth="2.6" strokeLinecap="round" />
        <rect x="52" y="84" width="16" height="5" rx="2.5" fill="#E5E7EB" />
      </svg>
    );
  }
  return (
    <svg className="cb-planx__mascot" viewBox="0 0 120 120" aria-hidden>
      <path className="cb-planx__tw" d="M104 20l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#FDE68A" />
      <rect x="12" y="62" width="30" height="42" rx="6" fill="#7C83FF" />
      <rect x="80" y="54" width="28" height="50" rx="6" fill="#5A61E0" />
      <rect x="34" y="28" width="52" height="76" rx="10" fill="#A78BFA" />
      <path d="M60 28V10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path className="cb-planx__flag" d="M60 10h20l-6 6 6 6H60z" fill="#FBBF24" />
      <g fill="#FDE68A">
        <rect className="cb-planx__tw" x="42" y="38" width="10" height="9" rx="2.5" />
        <rect className="cb-planx__tw" style={{ animationDelay: '.7s' }} x="68" y="38" width="10" height="9" rx="2.5" />
        <rect className="cb-planx__tw" style={{ animationDelay: '1.3s' }} x="42" y="52" width="10" height="9" rx="2.5" />
        <rect className="cb-planx__tw" style={{ animationDelay: '.3s' }} x="68" y="52" width="10" height="9" rx="2.5" />
      </g>
      <g className="cb-planx__eye">
        <circle cx="52" cy="76" r="4.6" fill="#fff" />
        <circle cx="68" cy="76" r="4.6" fill="#fff" />
        <circle cx="53" cy="77" r="2.4" fill="#0C1245" />
        <circle cx="69" cy="77" r="2.4" fill="#0C1245" />
      </g>
      <path d="M55 85q5 6 10 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="45" cy="83" r="3.4" fill="#F9A8D4" opacity=".75" />
      <circle cx="75" cy="83" r="3.4" fill="#F9A8D4" opacity=".75" />
      <rect x="8" y="102" width="104" height="6" rx="3" fill="#7C3AED" />
    </svg>
  );
}

export type EmployerConfirmPlanProps = {
  planId: EmployerSubscriptionPlanId | string;
  changePlanHref: string;
  onConfirm: (plan: EmployerSubscriptionPlan) => void | Promise<void>;
  onPlanChange?: (planId: ConfirmPlanId) => void;
  confirmBusy?: boolean;
};

export function EmployerConfirmPlan({
  planId,
  changePlanHref,
  onConfirm,
  onPlanChange,
  confirmBusy = false,
}: EmployerConfirmPlanProps) {
  const initial = isConfirmPlanId(planId) ? planId : 'starter';
  const [activeId, setActiveId] = useState<ConfirmPlanId>(initial);
  const [displayTotal, setDisplayTotal] = useState('₹0');
  const [confirmedFlash, setConfirmedFlash] = useState(false);
  const [swapKey, setSwapKey] = useState(0);
  const [indStyle, setIndStyle] = useState<CSSProperties>({ width: 0, transform: 'translateX(0px)' });
  const totalFrom = useRef(0);
  const segRef = useRef<HTMLDivElement>(null);

  const plans = useMemo(
    () =>
      CONFIRM_PLAN_IDS.map((id) => getEmployerSubscriptionPlan(id)).filter(
        (p): p is EmployerSubscriptionPlan => Boolean(p),
      ),
    [],
  );

  const plan = getEmployerSubscriptionPlan(activeId) ?? plans[0];

  useEffect(() => {
    if (isConfirmPlanId(planId) && planId !== activeId) {
      setActiveId(planId);
      setSwapKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when URL plan changes
  }, [planId]);

  const gstBreakdown = useMemo(
    () => (plan && plan.amountPaise != null ? computeSubscriptionGst(plan.amountPaise) : null),
    [plan],
  );

  useEffect(() => {
    if (!plan || plan.amountPaise == null) {
      setDisplayTotal('Custom');
      return;
    }
    const totalPaise = computeSubscriptionGst(plan.amountPaise).totalPaise;
    const to = Math.round(totalPaise / 100);
    const from = totalFrom.current;
    totalFrom.current = to;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      setDisplayTotal(formatInrWhole(Math.round(from + (to - from) * e) * 100));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [plan]);

  function moveInd() {
    const root = segRef.current;
    if (!root) return;
    const on = root.querySelector<HTMLButtonElement>('button.is-on');
    if (!on) return;
    setIndStyle({ width: on.offsetWidth, transform: `translateX(${on.offsetLeft}px)` });
  }

  useLayoutEffect(() => {
    moveInd();
  }, [activeId, plans.length]);

  useEffect(() => {
    const onResize = () => moveInd();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeId]);

  function selectPlan(id: ConfirmPlanId) {
    setActiveId(id);
    setSwapKey((k) => k + 1);
    onPlanChange?.(id);
  }

  function handleConfirm(e: MouseEvent) {
    if (!plan || confirmBusy) return;
    setConfirmedFlash(true);
    window.setTimeout(() => setConfirmedFlash(false), 2600);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < 32; i += 1) {
        const d = document.createElement('i');
        d.className = 'cb-planx__bit';
        d.style.background = BIT_COLORS[i % 5];
        d.style.left = `${e.clientX}px`;
        d.style.top = `${e.clientY}px`;
        document.body.appendChild(d);
        const a = Math.random() * 6.28;
        const v = 60 + Math.random() * 140;
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
    void onConfirm(plan);
  }

  if (!plan) return null;

  const jobLabel =
    plan.activeJobLimit == null
      ? 'Job posts'
      : plan.activeJobLimit === 1
        ? 'Active job post'
        : 'Job posts';
  const seatLabel =
    plan.loginSeats == null ? 'Login seats' : plan.loginSeats === 1 ? 'Employer login' : 'Login seats';

  return (
    <div className="cb-planx">
      <div className="cb-planx__glow cb-planx__glow--1" aria-hidden />
      <div className="cb-planx__glow cb-planx__glow--2" aria-hidden />
      <div className="cb-planx__grid" aria-hidden />

      <Link href={changePlanHref} className="cb-planx__back" aria-label="Back to plans">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back
      </Link>

      <main className="cb-planx__main">
        <div className="cb-planx__top cb-planx__in">
          <div className="cb-planx__logo">
            <span className="cb-planx__mark">
              <BrandMark />
            </span>
            <span>
              <b>SRSB</b> CareerBridge
            </span>
          </div>
          <span className="cb-planx__sec">
            <LockIcon />
            Secure checkout
          </span>
        </div>

        <nav className="cb-planx__steps cb-planx__in" style={{ '--d': '0.1s' } as CSSProperties} aria-label="Progress">
          <span className="cb-planx__st is-done">
            <i>✓</i>Choose plan
          </span>
          <span className="cb-planx__bar is-on" />
          <span className="cb-planx__st is-now">
            <i>2</i>Confirm plan
          </span>
          <span className="cb-planx__bar" />
          <span className="cb-planx__st">
            <i>3</i>Payment
          </span>
          <span className="cb-planx__bar" />
          <span className="cb-planx__st">
            <i>4</i>Post a job
          </span>
        </nav>

        <div className="cb-planx__layout">
          <section className="cb-planx__left cb-planx__in" style={{ '--d': '0.2s' } as CSSProperties}>
            <div className="cb-planx__seg" ref={segRef} role="tablist" aria-label="Plans">
              <span className="cb-planx__ind" style={indStyle} aria-hidden />
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={p.id === activeId}
                  className={p.id === activeId ? 'is-on' : undefined}
                  onClick={() => selectPlan(p.id as ConfirmPlanId)}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div key={swapKey} className={`cb-planx__swap${swapKey ? ' is-swap' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div className="cb-planx__hero">
                <div className="cb-planx__stage">
                  <div className="cb-planx__orbit" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="cb-planx__shadow" aria-hidden />
                  <Mascot id={activeId} />
                </div>
                <div>
                  <h1>{plan.name} plan</h1>
                  {plan.recommended ? <div className="cb-planx__chip">Recommended</div> : null}
                  <p className="cb-planx__tag">{shortTagline(plan)}</p>
                </div>
              </div>

              <div className="cb-planx__stats" aria-label="Plan limits">
                <div className="cb-planx__stat">
                  <b>{plan.activeJobLimit == null ? '∞' : plan.activeJobLimit}</b>
                  <span>{jobLabel}</span>
                </div>
                <div className="cb-planx__stat">
                  <b>{plan.loginSeats == null ? '∞' : plan.loginSeats}</b>
                  <span>{seatLabel}</span>
                </div>
                <div className="cb-planx__stat">
                  <b>{plan.candidateViewCredits == null ? '∞' : plan.candidateViewCredits}</b>
                  <span>Candidate views</span>
                </div>
              </div>

              <ul className="cb-planx__pills">
                {PILL_FEATURES[activeId].map((feature, i) => (
                  <li
                    key={`${activeId}-${feature}`}
                    className="cb-planx__pill"
                    style={{ animationDelay: `${150 + i * 80}ms` }}
                  >
                    <span className="cb-planx__ck">
                      <CheckIcon />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="cb-planx__ticket">
            <div className="cb-planx__t1">
              <h2>Order summary</h2>
              <div className="cb-planx__row">
                <span>Plan</span>
                <b>{plan.name}</b>
              </div>
              <div className="cb-planx__row">
                <span>Validity</span>
                <b>{validityLabel(plan)}</b>
              </div>
              <div className="cb-planx__row">
                <span>Unlocks</span>
                <b>Post a job</b>
              </div>
              {gstBreakdown ? (
                <>
                  <div className="cb-planx__row">
                    <span>Plan (excl. GST)</span>
                    <b>{formatInrFromPaise(gstBreakdown.taxablePaise)}</b>
                  </div>
                  <div className="cb-planx__row">
                    <span>GST {gstBreakdown.gstRatePercent}%</span>
                    <b>{formatInrFromPaise(gstBreakdown.gstPaise)}</b>
                  </div>
                </>
              ) : null}
              <div className="cb-planx__total">
                <span>Total</span>
                <b>{displayTotal}</b>
              </div>
            </div>
            <div className="cb-planx__t2">
              <h3>What happens next</h3>
              <div className="cb-planx__next">
                <div className="cb-planx__nx is-a">
                  <i>1</i>
                  <div>
                    <b>Confirm this plan</b>
                    Unlocks Post a job
                  </div>
                </div>
                <div className="cb-planx__nx">
                  <i>2</i>
                  <div>
                    <b>Pay with Razorpay</b>
                    Secure checkout · server-controlled amount
                  </div>
                </div>
                <div className="cb-planx__nx">
                  <i>3</i>
                  <div>
                    <b>Post your first job</b>
                    Start receiving applicants
                  </div>
                </div>
              </div>
              <div className="cb-planx__note">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 8h.01" />
                </svg>
                Secure Razorpay checkout. Amount is fixed by the server.
              </div>
              <button
                type="button"
                className={`cb-planx__btn cb-planx__btn--main${confirmedFlash ? ' is-ok' : ''}`}
                onClick={handleConfirm}
                disabled={confirmBusy}
                aria-busy={confirmBusy}
              >
                {confirmBusy
                  ? 'Securing payment…'
                  : confirmedFlash
                    ? 'Plan confirmed ✓'
                    : 'Continue to post a job'}
                {confirmBusy || confirmedFlash ? null : <ArrowIcon />}
              </button>
            </div>
          </aside>
        </div>

        <div className="cb-planx__trust cb-planx__in" style={{ '--d': '0.4s' } as CSSProperties}>
          <span>
            <LockIcon />
            Secure Razorpay checkout
          </span>
          <span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12l4 4 10-10" />
            </svg>
            Fixed prices, no surprises
          </span>
          <span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            Email support
          </span>
        </div>
        <p className="cb-planx__foot cb-planx__in" style={{ '--d': '0.5s' } as CSSProperties}>
          Need help choosing? Write to{' '}
          <a href={`mailto:${EMPLOYER_SUPPORT_EMAIL}`}>{EMPLOYER_SUPPORT_EMAIL}</a>
        </p>
      </main>
    </div>
  );
}
