'use client';

import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

export default function ApplicationConfirmationPage() {
  const router = useRouter();

  return (
    <CandidateAppShell activeTab="applications" showBack title="Application Submitted" maxWidth="max-w-xl">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-xs text-center space-y-6 my-4">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#ecfdf5] text-[#059669] border border-emerald-200">
            <svg className="h-10 w-10 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Application submitted
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 max-w-sm mx-auto">
            Your Career Passport application has been received for <strong>Customer service executive</strong> at <strong>ABC Services</strong>.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4 max-w-sm mx-auto">
          <Button
            type="button"
            onClick={() => router.push('/applications')}
            className="w-full py-3.5 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-md hover:shadow-lg transition rounded-xl"
          >
            Track application
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/jobs')}
            className="w-full py-3.5 text-sm font-bold border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl"
          >
            Find more jobs
          </Button>
        </div>
      </div>
    </CandidateAppShell>
  );
}
