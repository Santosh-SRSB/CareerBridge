'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getEmployerSubscriptionPlan, type EmployerSubscriptionPlan } from '@careerbridge/shared';
import { EmployerConfirmPlan } from '@/components/employer/EmployerConfirmPlan';
import { EmployerPricingPlans } from '@/components/employer/EmployerPricingPlans';
import { toast } from '@/components/ui/Toast';
import { userFacingError } from '@/lib/client-errors';
import { getEmployerMe } from '@/lib/api';
import { checkoutEmployerPlan } from '@/lib/employer-plan-checkout';
import { EMPLOYER_POST_JOB_HREF } from '@/lib/employer-plan-gate';
import './buy-fullpage.css';

function isPostJobIntent(raw: string | null) {
  return raw === 'post-job' || raw === 'post_job';
}

function PaymentSuccessScreen({
  plan,
  intentPostJob,
}: {
  plan: EmployerSubscriptionPlan;
  intentPostJob: boolean;
}) {
  return (
    <main className="cb-buy-full cb-buy-full--success" role="status" aria-live="polite">
      <div className="cb-buy-full__success-card">
        <div className="cb-buy-full__success-icon" aria-hidden>
          ✓
        </div>
        <p className="cb-buy-full__eyebrow">Payment successful</p>
        <h1>You&apos;re all set</h1>
        <p className="cb-buy-full__tag">
          <b>{plan.name}</b> plan ({plan.priceLabel}
          {plan.periodLabel}) is active. Post a job is unlocked.
        </p>
        <nav className="cb-buy-full__steps" aria-label="Progress">
          <span className="is-done">1 Choose plan</span>
          <span className="is-done">2 Confirm</span>
          <span className="is-done">3 Payment</span>
          <span className="is-now">4 Post a job</span>
        </nav>
        <div className="cb-buy-full__actions">
          {intentPostJob ? (
            <Link href={EMPLOYER_POST_JOB_HREF} className="cb-buy-full__cta">
              Continue to post a job
            </Link>
          ) : (
            <Link href="/employer/payments" className="cb-buy-full__cta">
              Go to Billing
            </Link>
          )}
          <Link href="/employer" className="cb-buy-full__ghost">
            Employer dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function BuyCreditsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const planId = params.get('plan');
  const intentPostJob = isPostJobIntent(params.get('intent'));
  const selected = useMemo(() => getEmployerSubscriptionPlan(planId), [planId]);
  const [paying, setPaying] = useState(false);
  const [paidPlan, setPaidPlan] = useState<EmployerSubscriptionPlan | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    void getEmployerMe()
      .then((me) => {
        const status = String(me.verificationStatus || 'UNVERIFIED').toUpperCase();
        const verified = Boolean(me.verified) || status === 'VERIFIED' || status === 'APPROVED';
        setNeedsVerification(!verified && status === 'UNVERIFIED');
      })
      .catch(() => setNeedsVerification(false));
  }, []);

  async function continueAfterConfirm(plan: EmployerSubscriptionPlan) {
    if (plan.contactSales || paying) return;
    if (needsVerification) {
      toast.error('Complete employer verification before purchasing a plan.');
      router.push('/employer/kyc');
      return;
    }
    setPaying(true);
    try {
      await checkoutEmployerPlan(plan);
      setPaidPlan(plan);
      toast.success(`${plan.name} plan payment successful.`);
    } catch (err) {
      const msg = userFacingError(err, 'complete payment');
      if (/cancel/i.test(msg)) return;
      if (/verification/i.test(msg)) {
        toast.error(msg);
        router.push('/employer/kyc');
        return;
      }
      if (/does not match registered website|risk_check|website.*not.*registered/i.test(msg)) {
        toast.error(
          'Razorpay blocked this live payment: add https://www.srsbcareerbridge.co.in under Account & Settings → Website and app, wait for approval, then pay again.',
        );
        return;
      }
      toast.error(msg);
    } finally {
      setPaying(false);
    }
  }

  function onSelectFromGrid(plan: EmployerSubscriptionPlan) {
    if (plan.contactSales) return;
    const qs = intentPostJob ? `intent=post-job&plan=${plan.id}` : `plan=${plan.id}`;
    router.replace(`/employer/payments/buy?${qs}`);
  }

  function onConfirmPlanChange(nextId: string) {
    const qs = intentPostJob ? `intent=post-job&plan=${nextId}` : `plan=${nextId}`;
    router.replace(`/employer/payments/buy?${qs}`);
  }

  if (paidPlan) {
    return <PaymentSuccessScreen plan={paidPlan} intentPostJob={intentPostJob} />;
  }

  if (needsVerification) {
    return (
      <main className="cb-buy-full cb-buy-full--success" role="status">
        <div className="cb-buy-full__success-card">
          <p className="cb-buy-full__eyebrow">Verification required</p>
          <h1>Verify your employer account</h1>
          <p className="cb-buy-full__tag">
            Complete KYC before checkout. Plans stay available after verification.
          </p>
          <div className="cb-buy-full__actions">
            <Link href="/employer/kyc" className="cb-buy-full__cta">
              Continue to verification
            </Link>
            <Link href="/employer/payments" className="cb-buy-full__ghost">
              Back to Billing
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (selected && !selected.contactSales) {
    return (
      <EmployerConfirmPlan
        planId={selected.id}
        changePlanHref={intentPostJob ? '/employer/payments/buy?intent=post-job' : '/employer/payments/buy'}
        onConfirm={continueAfterConfirm}
        onPlanChange={onConfirmPlanChange}
        confirmBusy={paying}
      />
    );
  }

  return (
    <main className="cb-buy-full cb-buy-full--plans">
      <EmployerPricingPlans
        signedIn
        initialPlanId={planId}
        continueHref={
          intentPostJob
            ? (plan) => `/employer/payments/buy?intent=post-job&plan=${plan.id}`
            : (plan) => `/employer/payments/buy?plan=${plan.id}`
        }
        onSelectPlan={onSelectFromGrid}
      />
    </main>
  );
}

export default function BuyCreditsPage() {
  return (
    <Suspense
      fallback={
        <main className="cb-buy-full cb-buy-full--loading" aria-busy="true">
          Loading plans…
        </main>
      }
    >
      <BuyCreditsInner />
    </Suspense>
  );
}
