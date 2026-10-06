'use client';

import Link from 'next/link';
import { EmployerShellFallback } from '@/components/EmployerPortal';

export default function BuyCreditsPage() {
  return (
    <EmployerShellFallback title="Buy credits">
      <div className="ep-billing ep-page">
        <header className="ep-billing__head">
          <div>
            <p className="ep-billing__eyebrow">Plan &amp; usage</p>
            <h1 className="ep-billing__title">Buy more credits</h1>
            <p className="ep-billing__sub">Extra candidate profile views for your Starter plan.</p>
          </div>
          <Link href="/employer/payments" className="ep-billing__back">
            ← Billing
          </Link>
        </header>

        <section className="ep-billing__plan" aria-labelledby="buy-status">
          <div>
            <h2 id="buy-status">Online payment is not available yet</h2>
            <p>
              Credit packs cannot be bought online until a payment provider is connected to CareerBridge.
              No payment has been taken and no credits have been added.
            </p>
            <p className="mt-2">
              Your monthly credits reset at the start of each month. Profiles of candidates who applied to
              your jobs are always free to view, and you can keep reviewing applicants in the meantime.
            </p>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/employer/payments" className="ep-billing__back inline-flex min-h-12 items-center">
            Back to Billing
          </Link>
          <Link href="/employer/applications" className="ep-billing__back inline-flex min-h-12 items-center">
            Review applicants
          </Link>
        </div>
      </div>
    </EmployerShellFallback>
  );
}
