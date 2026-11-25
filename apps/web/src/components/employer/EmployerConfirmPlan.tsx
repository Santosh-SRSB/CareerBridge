'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
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

const TRACK =
  'HIRE SMARTER ✦ POST JOBS ✦ FIND TALENT ✦ SRSB CAREERBRIDGE ✦ '.repeat(6);

const FLOAT_SHAPES = [
  '<path d="M12 2l2.6 6.6L21 10l-5 4.5L17.5 22 12 18.5 6.5 22 8 14.5 3 10l6.4-1.4z" fill="#FBBF24"/>',
  '<circle cx="12" cy="12" r="8" fill="none" stroke="#7C83FF" stroke-width="3"/>',
  '<path d="M12 4v16M4 12h16" stroke="#34D399" stroke-width="3" stroke-linecap="round"/>',
  '<rect x="5" y="5" width="14" height="14" rx="3" fill="#F472B6"/>',
];

const BIT_COLORS = ['#FBBF24', '#34D399', '#7C83FF', '#F472B6', '#fff'];

function isConfirmPlanId(id: string | null | undefined): id is ConfirmPlanId {
  return CONFIRM_PLAN_IDS.includes(id as ConfirmPlanId);
}

function validityLabel(plan: EmployerSubscriptionPlan) {
  if (plan.durationDays === 30) return '30 days';
  if (plan.durationDays === 90) return '3 months';
  if (plan.durationDays === 180) return '6 months';
  return plan.periodLabel.replace(/^\//, '').trim() || 'Custom';
}

function formatInr(paise: number | null) {
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

function Mascot({ id }: { id: ConfirmPlanId }) {
  if (id === 'starter') {
    return (
      <svg className="cb-confirm__mascot" viewBox="0 0 100 100" aria-hidden>
        <path d="M38 38v-9a6 6 0 016-6h12a6 6 0 016 6v9" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <rect x="16" y="36" width="68" height="50" rx="12" fill="#7C83FF" />
        <rect x="16" y="60" width="68" height="7" fill="#5A61E0" />
        <circle cx="50" cy="63" r="5" fill="#FBBF24" />
        <g className="cb-confirm__eye">
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
      <svg className="cb-confirm__mascot" viewBox="0 0 100 100" aria-hidden>
        <path d="M42 76Q50 100 58 76Z" className="cb-confirm__flame" fill="#FB923C" />
        <path d="M44 76Q50 90 56 76Z" className="cb-confirm__flame" fill="#FDE68A" />
        <path d="M36 58L18 80L36 74Z" fill="#FBBF24" />
        <path d="M64 58L82 80L64 74Z" fill="#FBBF24" />
        <path d="M50 6C70 22 72 52 65 76H35C28 52 30 22 50 6Z" fill="#fff" />
        <path d="M50 6C58 12 63 19 66 27H34C37 19 42 12 50 6Z" fill="#F87171" />
        <circle cx="50" cy="44" r="13" fill="#1D2688" stroke="#FBBF24" strokeWidth="3" />
        <g className="cb-confirm__eye">
          <circle cx="45" cy="42" r="2.6" fill="#FDE68A" />
          <circle cx="55" cy="42" r="2.6" fill="#FDE68A" />
        </g>
        <path d="M45 49q5 5 10 0" fill="none" stroke="#FDE68A" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="cb-confirm__mascot" viewBox="0 0 100 100" aria-hidden>
      <path d="M8 90q18-34 36 0z" fill="#FBBF24" />
      <path d="M56 90q18-34 36 0z" fill="#F472B6" />
      <path d="M32 90q18-38 36 0z" fill="#34D399" />
      <circle cx="26" cy="58" r="12" fill="#FDE68A" />
      <circle cx="74" cy="58" r="12" fill="#FBCFE8" />
      <circle cx="50" cy="46" r="14" fill="#A7F3D0" />
      <g className="cb-confirm__eye">
        <circle cx="46" cy="44" r="2" fill="#0C1245" />
        <circle cx="54" cy="44" r="2" fill="#0C1245" />
      </g>
      <g className="cb-confirm__eye">
        <circle cx="22" cy="56" r="1.7" fill="#0C1245" />
        <circle cx="30" cy="56" r="1.7" fill="#0C1245" />
      </g>
      <g className="cb-confirm__eye">
        <circle cx="70" cy="56" r="1.7" fill="#0C1245" />
        <circle cx="78" cy="56" r="1.7" fill="#0C1245" />
      </g>
      <path d="M45 51q5 5 10 0M22 62q4 4 8 0M70 62q4 4 8 0" fill="none" stroke="#0C1245" strokeWidth="2" strokeLinecap="round" />
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
  const totalFrom = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

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
      const k = Math.min(1, (t - t0) / 600);
      const e = 1 - Math.pow(1 - k, 3);
      setDisplayTotal(formatInr(Math.round(from + (to - from) * e) * 100));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [plan]);

  const floaters = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 96}%`,
        top: `${Math.random() * 95}%`,
        width: `${16 + Math.random() * 20}px`,
        d: `${6 + Math.random() * 7}s`,
        delay: `-${Math.random() * 6}s`,
        shape: FLOAT_SHAPES[i % 4],
      })),
    [],
  );

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
      for (let i = 0; i < 30; i += 1) {
        const d = document.createElement('i');
        d.className = 'cb-confirm__bit';
        d.style.background = BIT_COLORS[i % 5];
        d.style.left = `${e.clientX}px`;
        d.style.top = `${e.clientY}px`;
        document.body.appendChild(d);
        const a = Math.random() * 6.28;
        const v = 60 + Math.random() * 130;
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

  return (
    <div className="cb-confirm">
      <div className="cb-confirm__rail cb-confirm__rail--l" aria-hidden>
        <span className="cb-confirm__track">{TRACK}</span>
      </div>
      <div className="cb-confirm__rail cb-confirm__rail--r" aria-hidden>
        <span className="cb-confirm__track">{TRACK}</span>
      </div>
      <div className="cb-confirm__glow cb-confirm__glow--1" aria-hidden />
      <div className="cb-confirm__glow cb-confirm__glow--2" aria-hidden />
      <div aria-hidden>
        {floaters.map((f) => (
          <div
            key={f.id}
            className="cb-confirm__fl"
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

      <main className="cb-confirm__main">
        <div className="cb-confirm__top">
          <div className="cb-confirm__logo">
            <b>SRSB</b> CareerBridge
          </div>
          <span className="cb-confirm__sec">
            <LockIcon />
            Secure checkout
          </span>
        </div>

        <nav className="cb-confirm__steps" aria-label="Progress">
          <span className="cb-confirm__st is-done">
            <i>✓</i>Choose plan
          </span>
          <span className="cb-confirm__bar is-on" />
          <span className="cb-confirm__st is-now">
            <i>2</i>Confirm plan
          </span>
          <span className="cb-confirm__bar" />
          <span className="cb-confirm__st">
            <i>3</i>Payment
          </span>
          <span className="cb-confirm__bar" />
          <span className="cb-confirm__st">
            <i>4</i>Post a job
          </span>
        </nav>

        <div
          className="cb-confirm__panel"
          id="panel"
          ref={panelRef}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
            e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
          }}
        >
          <section className="cb-confirm__left">
            <span className="cb-confirm__eyebrow">POST A JOB</span>
            <div className="cb-confirm__seg" role="tablist" aria-label="Plans">
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
            <div className={`cb-confirm__head${swapKey ? ' is-swap' : ''}`} key={swapKey}>
              <div className="cb-confirm__tile">
                <Mascot id={activeId} />
              </div>
              <div>
                <h1>
                  {plan.name} plan
                  {plan.recommended ? <span className="cb-confirm__chip">RECOMMENDED</span> : null}
                </h1>
                <p className="cb-confirm__tag">{plan.tagline}</p>
              </div>
            </div>
            <ul className="cb-confirm__features">
              {plan.features.map((feature, i) => (
                <li key={`${plan.id}-${feature}`} style={{ animationDelay: `${120 + i * 70}ms` }}>
                  <span className="cb-confirm__ck">
                    <CheckIcon />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          <aside className="cb-confirm__right">
            <h2>Order summary</h2>
            <div className="cb-confirm__row">
              <span>Plan</span>
              <b>{plan.name}</b>
            </div>
            <div className="cb-confirm__row">
              <span>Validity</span>
              <b>{validityLabel(plan)}</b>
            </div>
            <div className="cb-confirm__row">
              <span>Unlocks</span>
              <b>Post a job</b>
            </div>
            {gstBreakdown ? (
              <>
                <div className="cb-confirm__row">
                  <span>Plan (excl. GST)</span>
                  <b>{formatInrFromPaise(gstBreakdown.taxablePaise)}</b>
                </div>
                <div className="cb-confirm__row">
                  <span>GST {gstBreakdown.gstRatePercent}%</span>
                  <b>{formatInrFromPaise(gstBreakdown.gstPaise)}</b>
                </div>
              </>
            ) : null}
            <div className="cb-confirm__total">
              <span>Total payable</span>
              <b>{displayTotal}</b>
            </div>
            <h3 className="cb-confirm__h3">WHAT HAPPENS NEXT</h3>
            <div className="cb-confirm__next">
              <div className="cb-confirm__nx is-a">
                <i>1</i>
                <div>
                  <b>Confirm this plan</b>
                  Unlocks Post a job
                </div>
              </div>
              <div className="cb-confirm__nx">
                <i>2</i>
                <div>
                  <b>Pay with Razorpay</b>
                  Secure checkout · server-controlled amount
                </div>
              </div>
              <div className="cb-confirm__nx">
                <i>3</i>
                <div>
                  <b>Post your first job</b>
                  Start receiving applicants
                </div>
              </div>
            </div>
            <div className="cb-confirm__note">
              <span>ℹ️</span>
              <span>Secure Razorpay checkout. Amount is fixed by the server — never trust the browser alone.</span>
            </div>
            <div className="cb-confirm__acts">
              <button
                type="button"
                className={`cb-confirm__btn cb-confirm__btn--main${confirmedFlash ? ' is-ok' : ''}`}
                onClick={handleConfirm}
                disabled={confirmBusy}
                aria-busy={confirmBusy}
              >
                {confirmBusy
                  ? 'Securing payment…'
                  : confirmedFlash
                    ? 'Plan confirmed ✓'
                    : 'Pay securely & continue'}
                {confirmBusy || confirmedFlash ? null : <ArrowIcon />}
              </button>
              <Link href={changePlanHref} className="cb-confirm__btn cb-confirm__btn--ghost">
                Change plan
              </Link>
            </div>
          </aside>
        </div>

        <div className="cb-confirm__trust">
          <span>
            <LockIcon />
            Secure Razorpay checkout
          </span>
          <span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12l4 4 10-10" />
            </svg>
            Transparent pricing
          </span>
          <span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            Email support
          </span>
        </div>
        <p className="cb-confirm__foot">
          UPI QR pays this order only — plan unlocks for your logged-in employer account, not for whoever scans.
          Need help? Write to <a href={`mailto:${EMPLOYER_SUPPORT_EMAIL}`}>{EMPLOYER_SUPPORT_EMAIL}</a>
        </p>
      </main>
    </div>
  );
}
