import type { Metadata } from 'next';
import { EmployerPricingPlans } from '@/components/employer/EmployerPricingPlans';

export const metadata: Metadata = {
  title: 'Employer Pricing | SRSB CareerBridge',
  description:
    'Starter, Growth, Business and Enterprise plans for employers. Clear pricing for job posts, login seats and candidate database views.',
};

export default function PublicEmployerPricingPage() {
  return <EmployerPricingPlans />;
}
