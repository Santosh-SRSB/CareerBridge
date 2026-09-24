'use client';

import { FormEvent, useEffect, useState } from 'react';
import { StarRating } from '@/components/StarRating';
import { dismissTestimonialPrompt, getTestimonialPrompt, submitTestimonial } from '@/lib/api';
import { getStoredUser } from '@/lib/session';

type Prompt = {
  source: string;
  audience: 'CANDIDATE' | 'EMPLOYER';
  title: string;
  subtitle: string;
};

export function TestimonialPromptCard({ audience }: { audience: 'CANDIDATE' | 'EMPLOYER' }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [hidden, setHidden] = useState(false);
  const [rating, setRating] = useState(0);
  const [quote, setQuote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;
    void getTestimonialPrompt()
      .then((next) => {
        if (!next || next.audience !== audience) return;
        setPrompt(next);
      })
      .catch(() => undefined);
  }, [audience]);

  if (!prompt || hidden) return null;

  async function onSkip() {
    setHidden(true);
    if (!prompt) return;
    void dismissTestimonialPrompt(prompt.source).catch(() => undefined);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!prompt) return;
    if (rating < 1) {
      setError('Please tap a star rating.');
      return;
    }
    if (quote.trim().length < 20) {
      setError('Please write at least 20 characters about your experience.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = getStoredUser();
      await submitTestimonial({
        rating,
        quote: quote.trim(),
        source: prompt.source,
        displayName: user?.firstName || undefined,
      });
      setDone(true);
      window.setTimeout(() => setHidden(true), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cb-feedback-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#d7eef6] bg-white shadow-[0_24px_60px_rgba(10,46,44,0.28)]">
        <div className="bg-gradient-to-br from-[#fff8e8] via-white to-[#eef8fb] px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#b45309]">
            Quick feedback
          </p>
          <h3
            id="cb-feedback-title"
            className="mt-1.5 text-center text-lg font-extrabold leading-snug text-[#0a2e2c] sm:text-xl"
          >
            {prompt.title}
          </h3>
          <p className="mt-1.5 text-center text-sm leading-relaxed text-[#5a7a82]">{prompt.subtitle}</p>
        </div>

        {done ? (
          <div className="px-5 py-8 text-center sm:px-6">
            <p className="text-base font-extrabold text-[#0a2e2c]">Thank you!</p>
            <p className="mt-1 text-sm text-[#5a7a82]">Your feedback helps other youth on CareerBridge.</p>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
            <div>
              <p className="mb-2 text-center text-sm font-bold text-[#0a2e2c]">How would you rate us?</p>
              <StarRating value={rating} onChange={setRating} size="lg" />
              {rating > 0 ? (
                <p className="mt-1.5 text-center text-xs font-semibold text-amber-700">
                  {rating} / 5 stars
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="cb-feedback-quote" className="mb-1.5 block text-sm font-bold text-[#0a2e2c]">
                A short note
              </label>
              <textarea
                id="cb-feedback-quote"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder="What worked well for you?"
                className="w-full resize-none rounded-xl border border-[#cfe6ee] bg-[#f7fcfe] px-3 py-2.5 text-sm leading-relaxed text-[#0a2e2c] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/25"
              />
              <p className="mt-1 text-xs text-[#7a9aa3]">{quote.length}/600 · min 20 characters</p>
            </div>

            {error ? <p className="text-center text-sm font-semibold text-red-600">{error}</p> : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-sm font-extrabold text-[#422006] shadow-[0_8px_20px_rgba(245,158,11,0.35)] transition hover:brightness-105 disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Submit rating'}
              </button>
              <button
                type="button"
                onClick={() => void onSkip()}
                className="inline-flex items-center justify-center rounded-full border border-[#d7eef6] bg-white px-4 py-2.5 text-sm font-bold text-[#0a2e2c]"
              >
                Not now
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
