/** Employer subscription catalog shown on Pricing / Billing (checkout after sign-in). */

export type EmployerSubscriptionPlanId = 'starter' | 'growth' | 'business' | 'enterprise';

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
  /** Contact sales instead of checkout */
  contactSales?: boolean;
  /** Amount in paise for paid plans; null for custom */
  amountPaise: number | null;
  /** Access window in days; null for custom */
  durationDays: number | null;
  activeJobLimit: number | null;
  loginSeats: number | null;
  candidateViewCredits: number | null;
};

export const EMPLOYER_SUPPORT_EMAIL = 'support@srsbcareerbridge.com';

export const EMPLOYER_SUBSCRIPTION_PLANS: readonly EmployerSubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: '30 days · For small businesses and occasional hiring',
    priceLabel: '₹1',
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
    amountPaise: 100,
    durationDays: 30,
    activeJobLimit: 1,
    loginSeats: 1,
    candidateViewCredits: 100,
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: '3 months · For growing companies',
    priceLabel: '₹2',
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
    amountPaise: 200,
    durationDays: 90,
    activeJobLimit: 5,
    loginSeats: 3,
    candidateViewCredits: 500,
  },
  {
    id: 'business',
    name: 'Business',
    tagline: '6 months · For regular recruitment teams',
    priceLabel: '₹3',
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
    amountPaise: 300,
    durationDays: 180,
    activeJobLimit: 10,
    loginSeats: 5,
    candidateViewCredits: 1200,
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
  },
] as const;

export function getEmployerSubscriptionPlan(
  id: string | null | undefined,
): EmployerSubscriptionPlan | undefined {
  if (!id) return undefined;
  const key = String(id).trim().toLowerCase();
  return EMPLOYER_SUBSCRIPTION_PLANS.find((p) => p.id === key);
}

export function isEmployerSubscriptionPlanId(value: string | null | undefined): value is EmployerSubscriptionPlanId {
  return Boolean(getEmployerSubscriptionPlan(value));
}
