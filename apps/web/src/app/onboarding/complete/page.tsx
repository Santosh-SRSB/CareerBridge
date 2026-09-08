'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { getCandidateMe } from '@/lib/api';
import { markResumeStartWizardFromProfile } from '@/features/resume/resume-wizard-draft';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [completion, setCompletion] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        setCompletion(profile.profileCompletion);
        patchStoredUser({
          firstName: profile.firstName,
          onboardingCompleted: true,
        });
      })
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f4] px-5 py-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0a2e2c]/10 text-[#0a2e2c]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 12.5l2 2 4.5-4.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#0d9488]">
          You&apos;re ready
        </p>
        <h1 className="mt-2 text-center text-2xl font-extrabold tracking-tight text-slate-900">
          Create your resume
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
          Your Career Passport is {completion}% complete. Choose how you want to add a resume.
        </p>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#e68a39] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, completion))}%` }}
          />
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push('/resume/upload')}
            className="group flex cursor-pointer flex-col items-start rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left transition hover:border-[#0a2e2c]/40 hover:bg-white hover:shadow-md"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#0a2e2c] shadow-sm ring-1 ring-slate-200 transition group-hover:ring-[#0a2e2c]/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 16V7m0 0l-3.5 3.5M12 7l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 17.5V19a2 2 0 002 2h10a2 2 0 002-2v-1.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p className="mt-4 text-base font-extrabold text-slate-900">Upload resume</p>
            <p className="mt-1.5 text-sm leading-snug text-slate-600">
              Already have a PDF or Word file? Upload it and we&apos;ll extract your details.
            </p>
            <span className="mt-4 text-sm font-bold text-[#0a2e2c]">Upload file →</span>
          </button>

          <button
            type="button"
            onClick={() => {
              markResumeStartWizardFromProfile();
              router.push('/resume');
            }}
            className="group flex cursor-pointer flex-col items-start rounded-2xl border-2 border-[#0a2e2c] bg-[#0a2e2c] p-5 text-left text-white shadow-sm transition hover:bg-[#072422]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 4h7l4 4v12a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path d="M14 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path
                  d="M8.5 13h7M8.5 16.5h5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p className="mt-4 text-base font-extrabold">Build from Scratch</p>
            <p className="mt-1.5 text-sm leading-snug text-white/75">
              Use your Career Passport and walk through a short guided wizard.
            </p>
            <span className="mt-4 text-sm font-bold text-[#e68a39]">Start building →</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => router.replace('/dashboard')}
          className="mt-6 w-full cursor-pointer rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
        >
          Skip for now — go to Dashboard
        </button>
      </div>
    </main>
  );
}
