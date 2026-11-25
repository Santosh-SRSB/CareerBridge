/** Employer subscription catalog (public pricing + checkout entitlements). Guide §3. */

export type EmployerSubscriptionPlanId =
  | 'starter'
  | 'growth'
  | 'business'
  | 'staffing'
  | 'enterprise';

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
    priceLabel: '₹999',
    periodLabel: '/ 30 days',
    priceHint: '',
    features: [
      '1 active job post',
      '1 employer login',
      '100 candidate database views',
      'Applicant management',
      'Basic candidate filters',
      'Email support',
    ],
    cta: 'Get started',
    amountPaise: 99900,
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
    priceLabel: '₹2,999',
    periodLabel: '/ 3 mo',
    priceHint: 'About ₹1,000 per month',
    features: [
      '5 job posts',
      '3 employer login seats',
      '500 candidate database views',
      'Applicant management',
      'Advanced candidate filters',
      'Candidate shortlist',
      'Priority email support',
    ],
    cta: 'Get started',
    recommended: true,
    amountPaise: 299900,
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
    priceLabel: '₹5,999',
    periodLabel: '/ 6 mo',
    priceHint: 'About ₹1,000 per month',
    features: [
      '10 job posts',
      '5 employer login seats',
      '1,200 candidate database views',
      'Advanced candidate filters',
      'Candidate shortlist and tracking',
      'Priority support',
      'Job performance reports',
    ],
    cta: 'Get started',
    amountPaise: 599900,
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
    id: 'staffing',
    name: 'Staffing & On-Roll',
    tagline: 'Managed hiring · success fee on placement',
    priceLabel: '5% – 8.33%',
    periodLabel: '',
    priceHint: 'of CTC · success fee',
    features: [
      'Candidate Sourcing',
      'Screening',
      'Onboarding',
      'On-Roll Staff',
      'Compliance',
      'Replacement',
    ],
    cta: 'Talk With Us',
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
      jobPerformanceReports: false,
      bulkHiringSupport: true,
      supportTier: 'dedicated',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise / Customized',
    tagline: 'For companies with bulk hiring requirements',
    priceLabel: 'Custom',
    periodLabel: '',
    priceHint: 'Built around your hiring volume',
    features: [
      'Custom job posting limits',
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
