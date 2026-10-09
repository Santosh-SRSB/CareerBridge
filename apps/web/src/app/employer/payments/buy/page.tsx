'use client';

import Link from 'next/link';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EvPageHead } from '@/components/employer/ui';

export default function BuyCreditsPage() {
  return (
    <EmployerShellFallback title="Buy credits">
      <EvPageHead
        eyebrow="Account"
        title="Buy more credits"
        subtitle="Extra candidate profile views for your Starter plan."
        actions={
          <Link href="/employer/payments" className="ev-btn ev-btn--ghost">
            ← Billing
          </Link>
        }
      />

      <section className="ev-card ev-plan ev-mt" aria-labelledby="buy-status">
        <h2 id="buy-status" className="ev-h2">
          Online payment is not available yet
        </h2>
        <p className="ev-sub">
          Credit packs cannot be bought online until a payment provider is connected to CareerBridge. No payment has
          been taken and no credits have been added.
        </p>
        <p className="ev-sub">
          Your monthly credits reset at the start of each month. Profiles of candidates who applied to your jobs are
          always free to view, and you can keep reviewing applicants in the meantime.
        </p>
        <div className="ev-form-actions ev-form-actions--start">
          <Link href="/employer/payments" className="ev-btn ev-btn--ghost">
            Back to Billing
          </Link>
          <Link href="/employer/applications" className="ev-btn">
            Review applicants
          </Link>
        </div>
      </section>
    </EmployerShellFallback>
  );
}
