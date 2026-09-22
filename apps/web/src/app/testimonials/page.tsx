'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { listPublicTestimonials } from '@/lib/api';

type Row = {
  id: string;
  audience: 'CANDIDATE' | 'EMPLOYER';
  rating: number;
  quote: string;
  displayName: string;
  headline: string | null;
  createdAt: string;
};

type Filter = 'ALL' | 'CANDIDATE' | 'EMPLOYER';

export default function TestimonialsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    listPublicTestimonials()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load testimonials.'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((row) => row.audience === filter);
  }, [filter, rows]);

  return (
    <div className="min-h-screen bg-[#f3f8f6]">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5a7a82]">Testimonials</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0a2e2c] sm:text-4xl">
            What our community says
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5a7a82] sm:text-base">
            Real notes from candidates and employers on CareerBridge — reviewed by our team before
            they appear here.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'CANDIDATE', label: 'Candidates' },
              { id: 'EMPLOYER', label: 'Employers' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                filter === item.id
                  ? 'bg-[#0a2e2c] text-white'
                  : 'border border-[#d7eef6] bg-white text-[#0a2e2c] hover:border-[#0a2e2c]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? <p className="mt-8 text-sm text-[#5a7a82]">Loading stories…</p> : null}
        {error ? <p className="mt-8 text-sm font-semibold text-red-600">{error}</p> : null}

        {!loading && !error && visible.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#cfe5dc] bg-white p-8 text-center">
            <p className="text-sm text-[#5a7a82]">
              Approved testimonials will show up here. Have a story to share?
            </p>
            <Link
              href="/feedback"
              className="mt-4 inline-flex rounded-full bg-[#0a2e2c] px-5 py-2.5 text-sm font-bold text-white"
            >
              Leave feedback
            </Link>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {visible.map((row) => (
            <article
              key={row.id}
              className="rounded-[20px] border border-[#d7eef6] bg-white p-5 shadow-[0_10px_24px_rgba(10,46,44,0.06)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#e7f3ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0a2e2c]">
                  {row.audience === 'CANDIDATE' ? 'Candidate' : 'Employer'}
                </span>
                <span className="text-sm font-extrabold text-[#0a2e2c]">{'★'.repeat(row.rating)}</span>
              </div>
              <p className="mt-4 text-[15px] font-semibold leading-relaxed text-[#0a2e2c]">
                “{row.quote}”
              </p>
              <div className="mt-5 border-t border-[#e8f1ee] pt-4">
                <p className="text-sm font-extrabold text-[#0a2e2c]">{row.displayName}</p>
                {row.headline ? <p className="mt-0.5 text-xs font-semibold text-[#5a7a82]">{row.headline}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
