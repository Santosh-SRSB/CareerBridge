'use client';

import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';

export function WhatsAppInterviewNotice({
  interview,
  onConfirm,
  onReschedule,
  busy = false,
}: {
  interview: ScheduledJobInterview;
  onConfirm?: () => void;
  onReschedule?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#dcf8c6] bg-[#e7ffdb] p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-[#075e54]">WhatsApp notification preview</p>
      <div className="mt-3 rounded-xl bg-white p-4 text-sm text-slate-800 shadow-sm">
        <p>
          <strong>{interview.companyName}</strong> has scheduled an interview for{' '}
          <strong>{interview.jobTitle}</strong>.
        </p>
        <p className="mt-2">
          Date: {new Date(interview.scheduledDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <p>Time: {interview.scheduledTime}</p>
        <p className="mt-2 text-slate-600">Please confirm your availability.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-[#25d366] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            Confirm Interview
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReschedule}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-60"
          >
            Request Reschedule
          </button>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        WhatsApp notifications help you stay updated on interviews.
      </p>
    </div>
  );
}
