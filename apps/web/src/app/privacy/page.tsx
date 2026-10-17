import type { Metadata } from 'next';
import { LegalPageShell, LegalSections } from '@/components/legal/LegalPageShell';
import {
  PRIVACY_INTRO,
  PRIVACY_META,
  PRIVACY_SECTIONS,
} from '@/lib/legal/privacy-content';

export const metadata: Metadata = {
  title: 'Privacy Policy | CareerBridge',
  description: PRIVACY_META.subtitle,
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title={PRIVACY_META.title}
      subtitle={PRIVACY_META.subtitle}
      effectiveDate={PRIVACY_META.effectiveDate}
      lastUpdated={PRIVACY_META.lastUpdated}
      relatedLinks={[
        { href: '/terms', label: 'Candidate Terms' },
        { href: '/employer/terms', label: 'Employer Terms' },
      ]}
      pdfHref="/legal/privacy-policy.pdf"
    >
      <div className="space-y-3 border-b border-slate-100 pb-6">
        {PRIVACY_INTRO.map((p) => (
          <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-slate-700">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-8">
        <LegalSections sections={PRIVACY_SECTIONS} />
      </div>
    </LegalPageShell>
  );
}
