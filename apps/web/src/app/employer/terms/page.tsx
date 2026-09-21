import type { Metadata } from 'next';
import { LegalPageShell, LegalSections } from '@/components/legal/LegalPageShell';
import {
  EMPLOYER_TERMS_INTRO,
  EMPLOYER_TERMS_META,
  EMPLOYER_TERMS_SECTIONS,
} from '@/lib/legal/employer-terms-content';

export const metadata: Metadata = {
  title: 'Employer Terms & Conditions | CareerBridge',
  description: EMPLOYER_TERMS_META.subtitle,
};

export default function EmployerTermsPage() {
  return (
    <LegalPageShell
      title={EMPLOYER_TERMS_META.title}
      subtitle={EMPLOYER_TERMS_META.subtitle}
      effectiveDate={EMPLOYER_TERMS_META.effectiveDate}
      lastUpdated={EMPLOYER_TERMS_META.lastUpdated}
      relatedLinks={[
        { href: '/privacy', label: 'Privacy Policy' },
        { href: '/terms', label: 'Candidate Terms' },
      ]}
      pdfHref="/legal/employer-terms.pdf"
    >
      <div className="space-y-3 border-b border-slate-100 pb-6">
        {EMPLOYER_TERMS_INTRO.map((p) => (
          <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-slate-700">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-8">
        <LegalSections sections={EMPLOYER_TERMS_SECTIONS} />
      </div>
    </LegalPageShell>
  );
}
