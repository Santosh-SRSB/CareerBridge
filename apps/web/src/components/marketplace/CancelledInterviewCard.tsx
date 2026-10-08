import type { ReactNode } from 'react';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';

export const EMPLOYER_CANCELLED_MESSAGE =
  'Due to some reason, the employer cancelled the interview. We will get back to you.';

export function cancelledInterviewMessage(interview: Pick<ScheduledJobInterview, 'cancelledBy'>) {
  return interview.cancelledBy === 'CANDIDATE' ? 'You declined this interview.' : EMPLOYER_CANCELLED_MESSAGE;
}

/** Interview detail opened from a cancellation notification: the cancellation message above the stored details. */
export function CancelledInterviewCard({
  interview,
  children,
}: {
  interview: Pick<ScheduledJobInterview, 'cancelledBy'>;
  children: ReactNode;
}) {
  return (
    <article
      data-testid="cancelled-interview-card"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p
        role="status"
        data-testid="cancelled-interview-message"
        className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-relaxed text-red-800"
      >
        {cancelledInterviewMessage(interview)}
      </p>
      {children}
    </article>
  );
}
