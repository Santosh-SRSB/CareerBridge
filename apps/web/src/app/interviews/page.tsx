'use client';

import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';

const btnOutline =
  'inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition';

const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-[#0a2e2c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#072422] transition';

export default function InterviewsHubPage() {
  const router = useRouter();

  return (
    <CandidateAppShell activeTab="interviews" showBack title="My interviews" maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Employer interviews and AI mock practice.</p>
          <button type="button" className={btnPrimary} onClick={() => router.push('/interviews/ai')}>
            Mock practice
          </button>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Upcoming</p>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Confirmed
              </span>
            </div>

            <h2 className="mt-2 text-base font-bold text-slate-900">Customer service executive</h2>
            <p className="text-xs text-slate-500">ABC Services · Chennai</p>
            <p className="mt-2 text-xs text-slate-600">12 Sep 2026 · 11:00 AM · Video call</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnOutline} onClick={() => router.push('/interviews/whatsapp')}>
                WhatsApp
              </button>
              <button type="button" className={btnPrimary} onClick={() => router.push('/interviews/ai')}>
                Prepare
              </button>
            </div>
          </article>
        </div>
      </div>
    </CandidateAppShell>
  );
}
