import type { ReactNode } from 'react';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';

export const EMPLOYER_CANCELLED_MESSAGE =
  'Due to some reason, the employer cancelled the interview. We will get back to you.';

export function cancelledInterviewMessage(interview: Pick<ScheduledJobInterview, 'cancelledBy'>) {
  return interview.cancelledBy === 'CANDIDATE' ? 'You declined this interview.' : EMPLOYER_CANCELLED_MESSAGE;
}

/** The interview card kept visible but faded and non-interactive, with the cancellation message centred over it. */
export function CancelledInterviewCard({
  interview,
  children,
}: {
  interview: Pick<ScheduledJobInterview, 'cancelledBy'>;
  children: ReactNode;
}) {
  return (
    <article
      aria-disabled="true"
      data-testid="cancelled-interview-card"
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div inert className="pointer-events-none select-none opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <p
          role="status"
          data-testid="cancelled-interview-message"
          className="max-w-sm rounded-xl border border-red-200 bg-white px-4 py-3 text-center text-sm font-bold leading-relaxed text-red-800 shadow-md"
        >
          {cancelledInterviewMessage(interview)}
        </p>
      </div>
    </article>
  );
}
