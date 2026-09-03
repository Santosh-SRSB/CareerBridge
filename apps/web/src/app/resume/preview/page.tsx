'use client';

import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

export default function ResumePreviewPage() {
  const router = useRouter();

  return (
    <CandidateAppShell activeTab="profile" showBack title="Resume preview" maxWidth="max-w-4xl">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Resume Preview</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
              ATS-compliant format generated directly from your verified Career Passport.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/resume/builder/start')}
              className="px-4 py-2.5 text-xs font-bold border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl"
            >
              Edit details
            </Button>
            <button
              type="button"
              onClick={() => router.push('/resume/guidance')}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-[#d97706] hover:bg-[#b45309] text-white rounded-xl shadow-xs transition"
            >
              <span>✦</span>
              <span>Improve with AI</span>
            </button>
            <Button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 text-xs font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white rounded-xl shadow-xs flex items-center gap-2"
            >
              <span>↓</span>
              <span>Download PDF</span>
            </Button>
          </div>
        </div>

        {/* Resume Paper Card */}
        <div className="rounded-2xl border border-slate-300 bg-white p-8 sm:p-12 shadow-sm space-y-6 max-w-3xl mx-auto">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl font-bold text-slate-900">Rahul Kumar</h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
              Chennai, Tamil Nadu · rahul.kumar@example.com · +91 98765 43210
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d9488]">
              Professional Summary
            </h3>
            <p className="text-sm leading-relaxed text-slate-800">
              Customer-focused professional with strong communication skills, active listening, and a passion for resolving client queries efficiently. Proven ability to handle high inquiry volumes with composure.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d9488]">
              Core Skills
            </h3>
            <p className="text-sm font-medium text-slate-800">
              Customer Relationship Management (CRM) · Verbal Communication · English Fluency · Conflict Resolution · MS Office &amp; Data Entry
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d9488]">
              Work Experience
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-bold text-slate-900">
                <span>Front Desk &amp; Guest Associate — Sunrise Hotel</span>
                <span className="text-xs text-slate-500 font-normal">2023 – 2025</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Managed front counter communications, assisted guests with check-in reservations, and handled phone inquiries with 98% positive guest feedback.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d9488]">
              Education
            </h3>
            <div className="flex justify-between text-sm font-bold text-slate-900">
              <span>Bachelor of Commerce (B.Com) — University of Madras</span>
              <span className="text-xs text-slate-500 font-normal">2020 – 2023</span>
            </div>
          </div>
        </div>
      </div>
    </CandidateAppShell>
  );
}
