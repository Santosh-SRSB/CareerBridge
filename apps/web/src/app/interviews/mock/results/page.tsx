'use client';

import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

export default function MockInterviewResultsPage() {
  const router = useRouter();

  const metrics = [
    { label: 'Communication & Tone', score: 82, desc: 'Professional, courteous and clear articulation', color: 'bg-[#0a2e2c]' },
    { label: 'Relevance to Question', score: 88, desc: 'Directly addressed customer resolution scenario', color: 'bg-[#0d9488]' },
    { label: 'Structure & Clarity', score: 79, desc: 'Well structured STAR method explanation', color: 'bg-[#0a2e2c]' },
    { label: 'Confidence & Fluency', score: 76, desc: 'Natural delivery with minimal filler hesitation', color: 'bg-[#d97706]' },
  ];

  return (
    <CandidateAppShell activeTab="interviews" showBack title="Your results" maxWidth="max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Interview Performance Report
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Detailed AI analysis based on speech clarity, content relevance, and behavioral fit.
          </p>
        </div>

        {/* Score Ring & Overview Grid */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-8 border-[#fde68a] bg-emerald-50/50 shadow-sm">
              <div className="text-center">
                <span className="text-3xl font-black text-slate-900">81%</span>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overall</p>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Ready for Employer Screening
              </span>
              <h2 className="text-xl font-bold text-slate-900">Strong Competency Demonstrated</h2>
              <p className="text-xs text-slate-500 max-w-sm">
                Your answers demonstrated high customer empathy, clear reasoning, and proactive problem solving.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => router.push('/interviews/ai')}
            className="w-full sm:w-auto px-6 py-3 text-xs sm:text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-sm rounded-xl shrink-0"
          >
            Practice another mock
          </Button>
        </div>

        {/* Category Breakdown & Detailed Feedback Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Metrics Column */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Scoring Breakdown
            </h3>
            <div className="space-y-4">
              {metrics.map((m) => (
                <div key={m.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-800">
                    <span>{m.label}</span>
                    <span className="font-mono">{m.score}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${m.color}`}
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Qualitative Insights Column */}
          <div className="space-y-6">
            {/* WHAT YOU DID WELL */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#059669]">
                ✓ Key Strengths
              </h3>
              <div className="space-y-2.5">
                {[
                  'Accurate understanding of customer dispute resolution',
                  'Structured response using concrete previous examples',
                  'Calm and professional tone of speech',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-white text-[11px] font-bold">
                      ✓
                    </span>
                    <span className="text-xs font-semibold text-slate-800 leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* TO IMPROVE */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600">
                ⚡ Opportunities for Growth
              </h3>
              <div className="space-y-2.5">
                {[
                  'Keep initial summary slightly more concise (<45s)',
                  'Mention specific metrics (e.g. resolution time improvement)',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300" />
                    <span className="text-xs font-semibold text-slate-800 leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CandidateAppShell>
  );
}
