/** Employer subscription catalog (public pricing + checkout entitlements). Guide §3. */

export type EmployerSubscriptionPlanId = 'starter' | 'growth' | 'business' | 'enterprise';

export type EmployerSubscriptionFeatureFlags = {
  /** Own-job applicants management (never consumes DB views). */
  applicantManagement: boolean;
  basicCandidateFilters: boolean;
  advancedCandidateFilters: boolean;
  /** Talent-pool / database shortlist (not own-job applicants). OD-11 interim: Starter = false. */
  candidateDatabaseShortlist: boolean;
  shortlistTracking: boolean;
  jobPerformanceReports: boolean;
  bulkHiringSupport: boolean;
  supportTier: 'email' | 'priority_email' | 'priority' | 'dedicated';
};

export type EmployerSubscriptionPlan = {
  id: EmployerSubscriptionPlanId;
  name: string;
  tagline: string;
  /** Display price, e.g. ₹999 or Custom */
  priceLabel: string;
  /** Period label next to price, e.g. / 30 days */
  periodLabel: string;
  /** Amber helper under price */
  priceHint: string;
  features: string[];
  cta: string;
  /** Highlighted “Recommended” card */
  recommended?: boolean;
  /** Contact sales instead of self-serve checkout (until Enterprise offer exists). */
  contactSales?: boolean;
  /** Amount in paise for paid plans; null for custom */
  amountPaise: number | null;
  /** Access window in days; null for custom */
  durationDays: number | null;
  activeJobLimit: number | null;
  loginSeats: number | null;
  candidateViewCredits: number | null;
  /** Feature entitlements — prefer these over stringly plan-name checks. */
  entitlements: EmployerSubscriptionFeatureFlags;
  renewalType: 'manual';
};

export const EMPLOYER_SUPPORT_EMAIL = 'support@srsbcareerbridge.com';

/**
 * Canonical catalogue. Prices are INR one-time charges (paise).
 * Tax inclusive/exclusive still open (OD-01) — display as listed until Finance confirms.
 */
export const EMPLOYER_SUBSCRIPTION_PLANS: readonly EmployerSubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: '30 days · For small businesses and occasional hiring',
    priceLabel: '₹1',
    periodLabel: '/ 30 days',
    priceHint: 'DEV test amount — restore ₹999 before prod',
    features: [
      '1 concurrent active job post',
      '1 employer login seat',
      '100 candidate database views per period',
      'Applicant management for own jobs',
      'Basic candidate filters',
      'Email support',
    ],
    cta: 'Choose plan',
    amountPaise: 100,
    durationDays: 30,
    activeJobLimit: 1,
    loginSeats: 1,
    candidateViewCredits: 100,
    renewalType: 'manual',
    entitlements: {
      applicantManagement: true,
      basicCandidateFilters: true,
      advancedCandidateFilters: false,
      candidateDatabaseShortlist: false,
      shortlistTracking: false,
      jobPerformanceReports: false,
      bulkHiringSupport: false,
      supportTier: 'email',
    },
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: '3 months · For growing companies',
    priceLabel: '₹1',
    periodLabel: '/ 3 mo',
    priceHint: 'DEV test amount — restore ₹2,999 before prod',
    features: [
      '5 concurrent active job posts',
      '3 employer login seats',
      '500 candidate database views per period',
      'Applicant management for own jobs',
      'Advanced candidate filters',
      'Candidate database shortlist',
      'Priority email support',
    ],
    cta: 'Choose plan',
    recommended: true,
    amountPaise: 100,
    durationDays: 90,
    activeJobLimit: 5,
    loginSeats: 3,
    candidateViewCredits: 500,
    renewalType: 'manual',
    entitlements: {
      applicantManagement: true,
      basicCandidateFilters: true,
      advancedCandidateFilters: true,
      candidateDatabaseShortlist: true,
      shortlistTracking: false,
      jobPerformanceReports: false,
      bulkHiringSupport: false,
      supportTier: 'priority_email',
    },
  },
  {
    id: 'business',
    name: 'Business',
    tagline: '6 months · For regular recruitment teams',
    priceLabel: '₹1',
    periodLabel: '/ 6 mo',
    priceHint: 'DEV test amount — restore ₹5,999 before prod',
    features: [
      '10 concurrent active job posts',
      '5 employer login seats',
      '1,200 candidate database views per period',
      'Advanced candidate filters',
      'Candidate shortlist and tracking',
      'Job performance reports',
      'Priority support',
    ],
    cta: 'Choose plan',
    amountPaise: 100,
    durationDays: 180,
    activeJobLimit: 10,
    loginSeats: 5,
    candidateViewCredits: 1200,
    renewalType: 'manual',
    entitlements: {
      applicantManagement: true,
      basicCandidateFilters: true,
      advancedCandidateFilters: true,
      candidateDatabaseShortlist: true,
      shortlistTracking: true,
      jobPerformanceReports: true,
      bulkHiringSupport: false,
      supportTier: 'priority',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise / Customized',
    tagline: 'For companies with bulk hiring requirements',
    priceLabel: 'Custom',
    periodLabel: '',
    priceHint: 'Configured offer required before online purchase',
    features: [
      'Custom concurrent job-post limits',
      'Multiple recruiter accounts',
      'Higher database access',
      'Dedicated account manager',
      'Bulk hiring support',
      'Custom reporting',
      'Special commercial arrangements',
    ],
    cta: 'Talk with us',
    contactSales: true,
    amountPaise: null,
    durationDays: null,
    activeJobLimit: null,
    loginSeats: null,
    candidateViewCredits: null,
    renewalType: 'manual',
    entitlements: {
      applicantManagement: true,
      basicCandidateFilters: true,
      advancedCandidateFilters: true,
      candidateDatabaseShortlist: true,
      shortlistTracking: true,
      jobPerformanceReports: true,
      bulkHiringSupport: true,
      supportTier: 'dedicated',
    },
  },
] as const;

/** Public-safe plan payload (no secrets / internal cost). */
export type PublicEmployerSubscriptionPlan = {
  id: EmployerSubscriptionPlanId;
  name: string;
  tagline: string;
  priceLabel: string;
  periodLabel: string;
  priceHint: string;
  features: string[];
  cta: string;
  recommended: boolean;
  contactSales: boolean;
  purchasableOnline: boolean;
  amountPaise: number | null;
  currency: 'INR';
  durationDays: number | null;
  activeJobLimit: number | null;
  loginSeats: number | null;
  candidateViewCredits: number | null;
  renewalType: 'manual';
  entitlements: EmployerSubscriptionFeatureFlags;
};

export function toPublicEmployerSubscriptionPlan(
  plan: EmployerSubscriptionPlan,
): PublicEmployerSubscriptionPlan {
  return {
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    priceLabel: plan.priceLabel,
    periodLabel: plan.periodLabel,
    priceHint: plan.priceHint,
    features: [...plan.features],
    cta: plan.cta,
    recommended: Boolean(plan.recommended),
    contactSales: Boolean(plan.contactSales),
    purchasableOnline: plan.amountPaise != null && !plan.contactSales,
    amountPaise: plan.amountPaise,
    currency: 'INR',
    durationDays: plan.durationDays,
    activeJobLimit: plan.activeJobLimit,
    loginSeats: plan.loginSeats,
    candidateViewCredits: plan.candidateViewCredits,
    renewalType: plan.renewalType,
    entitlements: { ...plan.entitlements },
  };
}

export function listPublicEmployerSubscriptionPlans(): PublicEmployerSubscriptionPlan[] {
  return EMPLOYER_SUBSCRIPTION_PLANS.map(toPublicEmployerSubscriptionPlan);
}

export function getEmployerSubscriptionPlan(
  id: string | null | undefined,
): EmployerSubscriptionPlan | undefined {
  if (!id) return undefined;
  const key = String(id).trim().toLowerCase();
  return EMPLOYER_SUBSCRIPTION_PLANS.find((p) => p.id === key);
}

export function isEmployerSubscriptionPlanId(
  value: string | null | undefined,
): value is EmployerSubscriptionPlanId {
  return Boolean(getEmployerSubscriptionPlan(value));
}
