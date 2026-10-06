'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AiFeedbackItem, AiFeedbackKind } from '@careerbridge/shared';
import { getAiFeedbackHistory } from '@/lib/api';
import { userFacingError } from '@/lib/client-errors';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/StateViews';

const KIND_LABEL: Record<AiFeedbackKind, string> = {
  RESUME_REVIEW: 'Resume review',
  RESUME_IMPROVEMENT: 'AI resume improvement',
  MOCK_INTERVIEW: 'Mock interview',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AiFeedbackHistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<AiFeedbackItem[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    getAiFeedbackHistory()
      .then(setItems)
      .catch((err) => setError(userFacingError(err, 'load your feedback history')));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <CandidateAppShell
      activeTab="profile"
      showBack
      title="AI Feedback"
      headerVariant="simple"
      maxWidth="max-w-2xl"
      onBack={() => router.push('/passport')}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">AI Feedback history</h1>
          <p className="mt-1 text-sm text-slate-700">
            Past resume reviews, AI resume improvements and mock interview feedback, newest first.
          </p>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items === null ? (
          <SkeletonList rows={3} label="Loading feedback history…" />
        ) : items.length === 0 ? (
          <EmptyState
            title="No feedback yet"
            message="Check your resume's ATS score or complete an AI mock interview to see feedback here."
            actionLabel="Check ATS score"
            onAction={() => router.push('/ats')}
          />
        ) : (
          <ul className="space-y-3" data-testid="ai-feedback-list">
            {items.map((item) => (
              <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{KIND_LABEL[item.kind]}</p>
                    <h2 className="mt-0.5 break-words text-base font-extrabold text-slate-900">{item.title}</h2>
                  </div>
                  {item.score != null ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-900">
                      {item.score}/100
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    {formatDate(item.at)}
                    {item.action ? ` · Action taken: ${item.action}` : ''}
                  </span>
                  <Link href={item.href} className="inline-flex min-h-12 items-center font-bold text-[#0a2e2c] underline">
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CandidateAppShell>
  );
}
