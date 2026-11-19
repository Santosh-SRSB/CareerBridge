import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Delete Account | SRSB Career Bridge',
  description:
    'How to request deletion of your SRSB Career Bridge account and associated personal data.',
};

export default function DeleteAccountPage() {
  return (
    <LegalPageShell
      title="Delete your account"
      subtitle="SRSB Career Bridge (SRSB Workforce Solutions Pvt. Ltd.) — request account and data deletion."
      relatedLinks={[
        { href: '/privacy', label: 'Privacy Policy' },
        { href: '/support', label: 'Support' },
      ]}
    >
      <div className="space-y-8 text-sm leading-relaxed text-slate-700">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">How to request account deletion</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Email{' '}
              <a className="font-semibold text-[#1a1fc4] underline" href="mailto:support@srsbcareerbridge.com">
                support@srsbcareerbridge.com
              </a>{' '}
              from the same email address registered on your Career Bridge account.
            </li>
            <li>
              Use the subject line: <strong>Delete my Career Bridge account</strong>.
            </li>
            <li>
              Include: full name, registered email and/or mobile number, and whether you are a{' '}
              <strong>Candidate</strong> or <strong>Employer</strong>.
            </li>
            <li>
              We will verify ownership of the account and confirm when deletion is completed. Typical
              response time is within <strong>one business day</strong>; deletion is completed within{' '}
              <strong>30 days</strong> where legally permitted.
            </li>
          </ol>
          <p>
            You may also submit a request via{' '}
            <Link href="/support" className="font-semibold text-[#1a1fc4] underline">
              Support
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">What is deleted</h2>
          <p>When your account deletion request is approved, we delete or anonymize where required:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Account login credentials and profile identifiers</li>
            <li>Candidate Career Passport / profile details, resume files, and application history</li>
            <li>Employer company profile details you provided (where not required for other legal purposes)</li>
            <li>In-app messages and interview practice records tied to your account</li>
            <li>Optional advertising preference / cookie choices linked to your account</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">What may be retained</h2>
          <p>
            Some information may be kept for a limited period where required by law, fraud prevention,
            dispute resolution, tax/accounting, or contractual obligations with employers (for example
            billing records, or application records an employer must retain). Retained data is restricted
            and not used for marketing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">Partial data deletion (without closing account)</h2>
          <p>
            You can update or remove many profile fields while signed in. For deletion of specific personal
            data without closing the account, email{' '}
            <a className="font-semibold text-[#1a1fc4] underline" href="mailto:support@srsbcareerbridge.com">
              support@srsbcareerbridge.com
            </a>{' '}
            with the subject <strong>Partial data deletion request</strong> and describe what you want
            removed. See also our{' '}
            <Link href="/privacy" className="font-semibold text-[#1a1fc4] underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </LegalPageShell>
  );
}
