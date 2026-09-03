'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

export default function AIResumeGuidancePage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);

  return (
    <CandidateAppShell activeTab="profile" showBack title="Improve your resume" maxWidth="max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            AI Resume Guidance
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            We analyzed your resume against recruiter job criteria and discovered impactful improvements.
          </p>
        </div>

        {/* Guidance Comparison Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Target Section: Professional Summary
            </h2>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              High Impact Recommendation
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Current */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Text</p>
              <div className="rounded-xl bg-slate-50 p-4 text-xs sm:text-sm italic text-slate-600 border border-slate-200/60 leading-relaxed min-h-[120px]">
                &quot;I am looking for a customer service job and have good communication skills to help clients.&quot;
              </div>
            </div>

            {/* AI Suggestion */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#b45309] uppercase tracking-wider">
                <span>✦</span> Optimized AI Suggestion
              </p>
              <div className="rounded-xl bg-[#fffbeb] p-4 text-xs sm:text-sm font-medium text-slate-800 border border-[#fde68a] leading-relaxed min-h-[120px]">
                &quot;Customer-focused professional with strong communication skills and a track record of resolving complex inquiries quickly and courteously in fast-paced support environments.&quot;
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {}}
              className="text-xs font-bold text-[#0d9488] hover:underline"
            >
              🔄 Generate alternate suggestions
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/resume/preview')}
                className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl"
              >
                Keep current
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setAccepted(true);
                  router.push('/resume/preview');
                }}
                className="flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white rounded-xl shadow-xs"
              >
                Accept recommendation
              </Button>
            </div>
          </div>
        </div>
      </div>
    </CandidateAppShell>
  );
}
