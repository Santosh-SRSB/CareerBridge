'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { dismissTestimonialPrompt, getTestimonialPrompt } from '@/lib/api';
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

  return (
    <aside className="rounded-[20px] border border-[#d7eef6] bg-gradient-to-br from-[#f3fbfe] via-white to-[#eef8fb] p-4 shadow-[0_10px_24px_rgba(47,143,173,0.10)] sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7a82]">Quick feedback</p>
      <h3 className="mt-1 text-base font-extrabold text-[#0a2e2c]">{prompt.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[#5a7a82]">{prompt.subtitle}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/feedback?source=${encodeURIComponent(prompt.source)}`}
          className="inline-flex rounded-full bg-[#0a2e2c] px-4 py-2 text-sm font-bold text-white"
        >
          Share feedback
        </Link>
        <button
          type="button"
          className="inline-flex rounded-full border border-[#d7eef6] bg-white px-4 py-2 text-sm font-bold text-[#0a2e2c]"
          onClick={() => {
            setHidden(true);
            void dismissTestimonialPrompt(prompt.source).catch(() => undefined);
          }}
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
