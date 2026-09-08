'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { WhatsAppInterviewNotice } from '@/components/marketplace/WhatsAppInterviewNotice';
import {
  confirmScheduledInterview,
  fetchScheduledInterview,
  rescheduleScheduledInterview,
} from '@/lib/candidate-marketplace-api';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';

export default function ScheduledInterviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [interview, setInterview] = useState<ScheduledJobInterview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchScheduledInterview(params.id).then(setInterview).catch(() => setInterview(null));
  }, [params.id]);

  async function handleConfirm() {
    if (!interview) return;
    setBusy(true);
    try {
      const next = await confirmScheduledInterview(interview.id);
      setInterview(next);
      setMessage('Interview confirmed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReschedule() {
    if (!interview) return;
    setBusy(true);
    try {
      const next = await rescheduleScheduledInterview(interview.id);
      setInterview(next);
      setMessage('Reschedule request sent.');
    } finally {
      setBusy(false);
    }
  }

  if (!interview) {
    return (
      <CandidateAppShell activeTab="interviews">
        <p className="text-slate-500">Loading interview details...</p>
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <Link href="/interviews" className="text-sm font-bold text-[#0a2e2c] hover:underline">
          ← My Interviews
        </Link>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-extrabold text-slate-900">{interview.jobTitle}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">{interview.companyName}</p>
          <p className="mt-4 text-sm text-slate-700">
            {new Date(interview.scheduledDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="text-sm font-bold text-slate-800">{interview.scheduledTime}</p>
          <p className="mt-2 text-sm text-slate-600">{interview.location}</p>
          <p className="mt-2 text-sm font-semibold text-emerald-700">
            Status: {interview.status === 'CONFIRMED' ? 'Confirmed ✓' : interview.status.replace(/_/g, ' ')}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => router.push(mockInterviewSetupUrl(interview.jobTitle))}>
              Prepare for Interview
            </Button>
          </div>
        </article>

        <WhatsAppInterviewNotice
          interview={interview}
          busy={busy}
          onConfirm={() => void handleConfirm()}
          onReschedule={() => void handleReschedule()}
        />

        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
      </div>
    </CandidateAppShell>
  );
}
