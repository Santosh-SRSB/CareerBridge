import type { Metadata } from 'next';
import { LegalPageShell, LegalSections } from '@/components/legal/LegalPageShell';
import {
  CANDIDATE_TERMS_INTRO,
  CANDIDATE_TERMS_META,
  CANDIDATE_TERMS_SECTIONS,
} from '@/lib/legal/candidate-terms-content';

export const metadata: Metadata = {
  title: 'Candidate Terms & Conditions | CareerBridge',
  description: CANDIDATE_TERMS_META.subtitle,
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title={CANDIDATE_TERMS_META.title}
      subtitle={CANDIDATE_TERMS_META.subtitle}
      effectiveDate={CANDIDATE_TERMS_META.effectiveDate}
      lastUpdated={CANDIDATE_TERMS_META.lastUpdated}
      relatedLinks={[
        { href: '/privacy', label: 'Privacy Policy' },
        { href: '/employer/terms', label: 'Employer Terms' },
      ]}
      pdfHref="/legal/candidate-terms.pdf"
    >
      <div className="space-y-3 border-b border-slate-100 pb-6">
        {CANDIDATE_TERMS_INTRO.map((p) => (
          <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-slate-700">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-8">
        <LegalSections sections={CANDIDATE_TERMS_SECTIONS} />
      </div>
    </LegalPageShell>
  );
}
