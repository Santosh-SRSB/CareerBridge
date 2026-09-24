'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/landing/Navbar';
import { StarRating } from '@/components/StarRating';
import { Button } from '@/components/ui/Button';
import { dismissTestimonialPrompt, getTestimonialPrompt, submitTestimonial } from '@/lib/api';
import { getStoredUser } from '@/lib/session';

export default function FeedbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceFromUrl = searchParams.get('source') || undefined;

  const [source, setSource] = useState(sourceFromUrl || 'MANUAL');
  const [title, setTitle] = useState('Share your CareerBridge experience');
  const [subtitle, setSubtitle] = useState(
    'Your words may appear on our testimonials page after admin review.',
  );
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent('/feedback')}`);
      return;
    }
    if (user.firstName) setDisplayName(user.firstName);
    void getTestimonialPrompt()
      .then((prompt) => {
        if (!prompt) return;
        setSource(prompt.source);
        setTitle(prompt.title);
        setSubtitle(prompt.subtitle);
      })
      .catch(() => undefined);
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await submitTestimonial({
        rating,
        quote,
        source,
        displayName: displayName.trim() || undefined,
      });
      setMessage(result.message);
      setQuote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback.');
    } finally {
      setLoading(false);
    }
  }

  async function onSkip() {
    try {
      await dismissTestimonialPrompt(source);
    } catch {
      // ignore
    }
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#f3f8f6]">
      <Navbar landingLinks={false} />
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#5a7a82]">Feedback</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#0a2e2c] sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-[#5a7a82]">{subtitle}</p>

        <form
          onSubmit={(event) => void onSubmit(event)}
          className="mt-6 space-y-4 rounded-[22px] border border-[#d7eef6] bg-white p-5 shadow-[0_12px_28px_rgba(10,46,44,0.08)] sm:p-6"
        >
          <div>
            <p className="mb-3 text-sm font-bold text-[#0a2e2c]">Your rating</p>
            <StarRating value={rating} onChange={setRating} size="lg" />
            <p className="mt-2 text-xs font-semibold text-amber-700">{rating} / 5 golden stars</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-[#0a2e2c]" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-[#cfe6ee] bg-[#f7fcfe] px-3 py-2.5 text-sm font-semibold text-[#0a2e2c] outline-none focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/15"
              placeholder="How should we show your name?"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-[#0a2e2c]" htmlFor="quote">
              Your feedback
            </label>
            <textarea
              id="quote"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={5}
              required
              minLength={20}
              maxLength={600}
              className="w-full rounded-xl border border-[#cfe6ee] bg-[#f7fcfe] px-3 py-2.5 text-sm leading-relaxed text-[#0a2e2c] outline-none focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/15"
              placeholder="What worked well for you on CareerBridge?"
            />
            <p className="mt-1 text-xs text-[#7a9aa3]">{quote.length}/600</p>
          </div>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={loading} block={false} className="!bg-[#0a2e2c] px-5">
              Submit feedback
            </Button>
            <Button type="button" variant="outline" block={false} onClick={() => void onSkip()}>
              Not now
            </Button>
          </div>
        </form>

        <p className="mt-5 text-center text-sm text-[#5a7a82]">
          See published stories on the{' '}
          <Link href="/testimonials" className="font-bold text-[#0a2e2c] underline">
            testimonials page
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
