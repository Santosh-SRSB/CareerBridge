/**
 * Platform revenue = employer payments with status PAID (amounts stored in paise, INR).
 * Pending, failed and refunded payments are reported separately and never counted. Each payment
 * row is summed once, straight from employer_payments with no joins, so nothing is double counted.
 * Candidate assessment packs and human mock bookings are not revenue: they are recorded without
 * any payment being collected.
 */
export const REVENUE_DEFINITION =
  'Sum of employer payments with status Paid. Pending, failed and refunded payments are excluded; each payment counts once.';

/** employer_payments.provider_ref prefix for job posting fees (see MatchingService.jobPostingProviderRef). */
export const JOB_POSTING_PROVIDER_REF_PREFIX = 'job_post:';

export type PaymentStatusGroup = {
  status: string;
  _sum: { amountPaise: number | null };
  _count: { _all: number };
};

export type PaymentBucket = { count: number; amountInr: number };

export function paiseToInr(paise: number | null | undefined): number {
  return (paise ?? 0) / 100;
}

export function bucketFor(groups: PaymentStatusGroup[], status: string): PaymentBucket {
  const group = groups.find((g) => g.status === status);
  return { count: group?._count._all ?? 0, amountInr: paiseToInr(group?._sum.amountPaise) };
}

export function revenueBySource(input: { totalPaise: number; jobPostingPaise: number; hiringFeePaise: number }) {
  const jobPostingFeesInr = paiseToInr(input.jobPostingPaise);
  const hiringFeesInr = paiseToInr(input.hiringFeePaise);
  return {
    jobPostingFeesInr,
    hiringFeesInr,
    otherInr: Math.max(0, paiseToInr(input.totalPaise - input.jobPostingPaise - input.hiringFeePaise)),
  };
}
