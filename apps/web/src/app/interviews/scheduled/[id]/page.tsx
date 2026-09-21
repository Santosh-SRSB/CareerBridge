'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { WhatsAppInterviewNotice } from '@/components/marketplace/WhatsAppInterviewNotice';
import {
  confirmScheduledInterview,
  fetchScheduledInterview,
  rescheduleScheduledInterview,
  submitScheduledInterviewFeedback,
} from '@/lib/candidate-marketplace-api';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';
import type { ScheduledJobInterview } from '@/lib/candidate-marketplace-api';

export default function ScheduledInterviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [interview, setInterview] = useState<ScheduledJobInterview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rating, setRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    fetchScheduledInterview(params.id).then(setInterview).catch(() => setInterview(null));
  }, [params.id]);

  async function handleConfirm() {
    if (!interview) return;
    setBusy(true);
    setError('');
    try {
      const next = await confirmScheduledInterview(interview.id);
      setInterview(next);
      setMessage('Interview confirmed. WhatsApp and email confirmation were sent when available.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm interview.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReschedule(payload: {
    preferredDate: string;
    preferredTime: string;
    reason?: string;
  }) {
    if (!interview) return;
    setBusy(true);
    setError('');
    try {
      const next = await rescheduleScheduledInterview(interview.id, payload);
      setInterview(next);
      setMessage('Reschedule request sent. Waiting for employer approval.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request reschedule.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFeedback(event: FormEvent) {
    event.preventDefault();
    if (!interview) return;
    setBusy(true);
    setError('');
    try {
      const next = await submitScheduledInterviewFeedback(interview.id, {
        rating,
        text: feedbackText.trim() || undefined,
      });
      setInterview(next);
      setMessage('Thank you. Your feedback was shared with the employer.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback.');
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

  const statusCopy =
    interview.status === 'CONFIRMED'
      ? 'Confirmed ✓'
      : interview.status === 'RESCHEDULE_REQUESTED'
        ? 'Reschedule pending'
        : interview.status === 'COMPLETED'
          ? 'Completed'
          : interview.status === 'CANCELLED'
            ? 'Cancelled'
            : 'Awaiting confirmation';

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
          <p
            className={`mt-2 text-sm font-semibold ${
              interview.status === 'CONFIRMED'
                ? 'text-emerald-700'
                : interview.status === 'RESCHEDULE_REQUESTED'
                  ? 'text-amber-700'
                  : interview.status === 'COMPLETED'
                    ? 'text-slate-700'
                    : 'text-slate-700'
            }`}
          >
            Status: {statusCopy}
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
          onReschedule={(payload) => void handleReschedule(payload)}
        />

        {interview.candidateFeedback ? (
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <h2 className="text-base font-extrabold text-slate-900">Your feedback</h2>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              Rating: {interview.candidateFeedback.rating}/5
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {interview.candidateFeedback.text || 'No written comments.'}
            </p>
          </article>
        ) : interview.canSubmitFeedback ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-extrabold text-slate-900">Share feedback</h2>
            <p className="mt-1 text-sm text-slate-600">
              Tell {interview.companyName} how the interview went. This is stored for that employer only.
            </p>
            <form onSubmit={(event) => void handleFeedback(event)} className="mt-4 space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-800">Rating</legend>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                        rating === value
                          ? 'bg-[#0c332c] text-white'
                          : 'border border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Textarea
                  label="Comments (optional)"
                  value={feedbackText}
                  onChange={(event) => setFeedbackText(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="What went well? What could improve?"
                />
              <Button type="submit" loading={busy} loadingLabel="Sending…">
                Submit feedback
              </Button>
            </form>
          </article>
        ) : null}

        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      </div>
    </CandidateAppShell>
  );
}
