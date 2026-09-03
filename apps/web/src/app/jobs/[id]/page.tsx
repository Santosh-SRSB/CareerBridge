'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleApply() {
    setLoading(true);
    setTimeout(() => {
      router.push(`/applications/${params.id || 'job-1'}/confirmation`);
    }, 400);
  }

  return (
    <CandidateAppShell activeTab="jobs" showBack title="Job details" maxWidth="max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2-Columns: Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Verified Opportunity
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Customer service executive
              </h1>
              <p className="text-base font-bold text-slate-700">ABC Services · Chennai</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 font-mono">
                  ₹18,000 – 22,000/mo
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Full time
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Day Shift
                </span>
              </div>
            </div>

            {/* ABOUT THE JOB */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                About the job
              </h2>
              <p className="text-sm leading-relaxed text-slate-700">
                Handle customer calls and messages, resolve issues with empathy, and maintain accurate records of every customer interaction in CRM systems. Comprehensive product and communication training is provided.
              </p>
            </div>

            {/* REQUIREMENTS */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Key Requirements &amp; Skill Fit
              </h2>
              <div className="space-y-2.5">
                {[
                  'Fluent English & Hindi communication',
                  'Customer handling & dispute resolution',
                  'Basic computer skills & typing',
                  'Active listening & phone etiquette',
                ].map((req) => (
                  <div key={req} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                    <span className="text-xs font-semibold text-slate-800">{req}</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#10b981] text-white">
                      <svg className="h-3.5 w-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right 1-Column: Match Card & Apply Action */}
        <div className="space-y-5 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4 text-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Your Profile Match
            </p>
            <div className="flex items-center justify-center">
              <div className="h-24 w-24 rounded-full border-4 border-emerald-500 bg-emerald-50 flex items-center justify-center shadow-inner">
                <span className="text-2xl font-black text-[#0a2e2c]">86%</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your verified Career Passport skills closely match all required criteria for this role.
            </p>

            <Button
              type="button"
              loading={loading}
              onClick={handleApply}
              className="w-full py-3.5 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-md hover:shadow-lg transition rounded-xl"
            >
              Apply now with Passport
            </Button>
          </div>
        </div>
      </div>
    </CandidateAppShell>
  );
}
