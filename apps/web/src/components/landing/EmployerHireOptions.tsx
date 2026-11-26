'use client';

import { EmployerHireWaysCards } from '@/components/landing/EmployerHireWaysCards';

/** Landing block: self-service + managed hiring, shown above pricing. */
export function EmployerHireOptions() {
  return (
    <section className="wl-hireopts" id="hire-options" aria-labelledby="wl-hireopts-title">
      <div className="wl-wrap">
        <div className="wl-hireopts__intro">
          <p className="wl-hireopts__kicker">How you can hire</p>
          <h2 id="wl-hireopts-title">Two ways to hire with SRSB</h2>
          <p>Self-service or fully managed. You decide.</p>
        </div>
        <EmployerHireWaysCards />
      </div>
    </section>
  );
}
