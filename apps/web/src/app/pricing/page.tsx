import type { Metadata } from 'next';
import { EmployerPricingPlans } from '@/components/employer/EmployerPricingPlans';

export const metadata: Metadata = {
  title: 'Employer Pricing | SRSB CareerBridge',
  description:
    'Starter ₹999, Growth ₹2,999, Business ₹5,999 and Enterprise custom plans. Concurrent job posts, recruiter seats and candidate database views.',
};

export default function PublicEmployerPricingPage() {
  return (
    <>
      <EmployerPricingPlans />
      <p
        style={{
          maxWidth: 920,
          margin: '0 auto 2.5rem',
          padding: '0 1.25rem',
          fontSize: '0.92rem',
          lineHeight: 1.55,
          color: '#475569',
          textAlign: 'center',
        }}
      >
        Active job posts are <strong>concurrent</strong> limits (closing a job frees a slot). Candidate database views
        are per subscription period and do not roll over. Viewing applicants to your own jobs does not use database
        views. Renewal is manual.
      </p>
    </>
  );
}
