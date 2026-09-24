'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import { JobRoleCombobox } from '@/components/marketplace/JobRoleCombobox';
import { createLiveInterview, getCandidateMe, startLiveInterview } from '@/lib/api';

const ROLE_CATALOG: Record<string, string[]> = {
  IT: [
    'Full Stack Developer',
    'Frontend Developer',
    'Backend Developer',
    'Software Developer',
    'Software Engineer',
    'Data Analyst',
    'DevOps Engineer',
    'QA Engineer',
    'Mobile App Developer',
    'React Developer',
    'Java Developer',
    'Python Developer',
  ],
  FINANCE: [
    'Accountant',
    'Financial Analyst',
    'Accounts Executive',
    'Auditor',
    'Tax Consultant',
    'Finance Executive',
  ],
  HR: [
    'HR Executive',
    'Talent Acquisition',
    'HR Generalist',
    'People Operations',
    'Recruiter',
  ],
  SALES: [
    'Sales Executive',
    'Business Development Executive',
    'Account Manager',
    'Retail Associate',
  ],
  MARKETING: [
    'Marketing Executive',
    'Digital Marketing Executive',
    'Content Marketer',
    'Brand Executive',
  ],
  GENERAL: [
    'Customer Service Executive',
    'Front Office Executive',
    'Business Analyst',
    'Operations Executive',
  ],
};

const OTHER_OPTION = 'Other (type your role)';

function detectCategory(interests: string[]): keyof typeof ROLE_CATALOG {
  const blob = interests.join(' ').toLowerCase();
  if (/\b(it|software|developer|engineer|tech|data|qa|devops)\b/.test(blob)) return 'IT';
  if (/\b(finance|account|caf|tax|audit|banking)\b/.test(blob)) return 'FINANCE';
  if (/\b(hr|human resource|talent|recruit)\b/.test(blob)) return 'HR';
  if (/\b(sales|bdm|business development|retail)\b/.test(blob)) return 'SALES';
  if (/\b(market|digital|seo|content|brand)\b/.test(blob)) return 'MARKETING';
  return 'GENERAL';
}

const QUESTION_COUNTS = [5, 8, 10];

function PushPinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="6.5" r="3.2" fill="#5bb8d4" stroke="#2f8fad" strokeWidth="1.2" />
      <path d="M12 9.5v8.5" stroke="#2f8fad" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M9.2 12.2h5.6l-.7 3.6H9.9l-.7-3.6Z"
        fill="#7ec8e3"
        stroke="#2f8fad"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PulseBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-1/2 h-16 w-full -translate-y-1/2 opacity-70"
      viewBox="0 0 320 64"
      fill="none"
      aria-hidden
      preserveAspectRatio="none"
    >
      <path
        d="M0 32h48l10-14 12 28 14-36 16 40 12-22 10 14H320"
        stroke="#9fd9ec"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0 36h56l8-10 10 20 12-26 14 28 10-16 8 10H320"
        stroke="#c5eaf5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

export default function MockInterviewSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get('role')?.trim() || '';

  const [jobRole, setJobRole] = useState(roleFromUrl || ROLE_CATALOG.IT[0]);
  const [customRole, setCustomRole] = useState('');
  const [interviewType, setInterviewType] = useState<'GENERIC' | 'ROLE'>(roleFromUrl ? 'ROLE' : 'GENERIC');
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleOptions, setRoleOptions] = useState([...ROLE_CATALOG.IT, OTHER_OPTION]);

  useEffect(() => {
    void getCandidateMe()
      .then((profile) => {
        const fromProfile = (profile.careerInterests || []).filter(Boolean);
        const category = detectCategory(fromProfile);
        const catalog = ROLE_CATALOG[category] || ROLE_CATALOG.GENERAL;
        const merged = [
          ...new Set([roleFromUrl, ...fromProfile, ...catalog, OTHER_OPTION].filter(Boolean)),
        ];
        setRoleOptions(merged);
        if (roleFromUrl) {
          setJobRole(roleFromUrl);
        } else if (fromProfile[0]) {
          setJobRole(fromProfile[0]);
        } else {
          setJobRole(catalog[0]);
        }
      })
      .catch(() => {
        const fallback = [...ROLE_CATALOG.GENERAL, OTHER_OPTION];
        setRoleOptions(roleFromUrl ? [roleFromUrl, ...fallback] : fallback);
        if (roleFromUrl) setJobRole(roleFromUrl);
      });
  }, [roleFromUrl]);

  const durationLimitMin = useMemo(() => Math.max(45, questionCount * 6), [questionCount]);
  const pickingOther = jobRole === OTHER_OPTION;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const role = (pickingOther ? customRole : jobRole).trim();
    if (role.length < 2) {
      setError(pickingOther ? 'Type your job role.' : 'Please enter a job role.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = await createLiveInterview({
        jobRole: role,
        interviewType: interviewType === 'GENERIC' ? 'BEHAVIOURAL' : 'ROLE',
        questionCount,
        durationLimitMin,
        source: 'PASSPORT',
      });
      await startLiveInterview(session.id);
      router.push(`/interviews/mock/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start mock interview. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-5xl">
      <div
        className="-mx-3 overflow-hidden rounded-[28px] px-4 py-6 sm:-mx-4 sm:px-6 sm:py-8 md:px-8"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(159, 217, 236, 0.55), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 10%, rgba(200, 236, 246, 0.7), transparent 50%), linear-gradient(180deg, #e8f6fb 0%, #f3fafc 48%, #eef8fb 100%)',
        }}
      >
        <div className="relative mb-6 sm:mb-8">
          <Link
            href="/interviews"
            className="absolute left-0 top-0 z-[1] inline-flex items-center gap-1.5 text-sm font-bold text-[#0a2e2c] transition hover:opacity-80"
          >
            <span aria-hidden className="text-base leading-none">
              ←
            </span>
            My Interviews
          </Link>

          <div className="mx-auto max-w-xl pt-8 text-center sm:pt-0">
            <h1 className="text-[1.65rem] font-extrabold tracking-tight text-[#0a2e2c] sm:text-3xl">
              AI Mock Interview
            </h1>
            <p className="mt-1.5 text-sm text-[#4a6b72] sm:text-[15px]">
              {roleFromUrl ? (
                <>
                  Practising for <span className="font-bold text-[#0a2e2c]">{roleFromUrl}</span>.
                </>
              ) : (
                'Practise with your AI Interviewer before the real thing.'
              )}
            </p>
          </div>
        </div>

        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] md:gap-8 lg:gap-10">
          <aside className="flex flex-col items-center gap-5 md:pt-2">
            <div className="relative flex w-full max-w-[280px] items-center justify-center py-4">
              <PulseBackdrop />
              <div className="relative z-[1]">
                <InterviewBotFace size="xl" />
              </div>
            </div>

            <div className="relative w-full max-w-sm rounded-2xl border border-[#d7eef6] bg-white px-5 pb-5 pt-7 shadow-[0_10px_28px_rgba(47,143,173,0.12)]">
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm">
                <PushPinIcon />
              </span>
              <p className="text-[13px] leading-relaxed text-[#35565f] sm:text-sm">
                <span className="font-extrabold text-[#0a2e2c]">Note:</span> This interview is for your
                betterment. Scores are not linked to any job application — please don’t cheat. Answer
                honestly so you can improve.
              </p>
            </div>
          </aside>

          <form
            onSubmit={(event) => void onSubmit(event)}
            className="space-y-5 rounded-[22px] border border-[#d7eef6] bg-white p-5 shadow-[0_12px_32px_rgba(47,143,173,0.12)] sm:p-6"
          >
            <JobRoleCombobox
              value={jobRole}
              options={roleOptions}
              onChange={(next) => {
                setJobRole(next);
                if (next !== OTHER_OPTION) setCustomRole('');
              }}
              showHint={false}
            />
            {pickingOther ? (
              <input
                className="mt-3 w-full rounded-xl border border-[#cfe6ee] bg-[#f7fcfe] px-3 py-2.5 text-sm font-semibold text-[#0a2e2c] outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/20"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="Type your job role"
                required
              />
            ) : null}

            <fieldset>
              <legend className="mb-2.5 text-sm font-bold text-[#0a2e2c]">Interview Type</legend>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="radio"
                    name="interviewType"
                    checked={interviewType === 'GENERIC'}
                    onChange={() => setInterviewType('GENERIC')}
                    className="mt-1 h-4 w-4 accent-[#0a2e2c]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#0a2e2c]">Generic</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#5a7a82]">
                      Communication, behavioural, and professional readiness — not purely technical.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="radio"
                    name="interviewType"
                    checked={interviewType === 'ROLE'}
                    onChange={() => setInterviewType('ROLE')}
                    className="mt-1 h-4 w-4 accent-[#0a2e2c]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#0a2e2c]">Role-Based</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#5a7a82]">
                      Uses your resume, profile, skills, projects, and selected job role automatically.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <div>
              <label htmlFor="questionCount" className="mb-2 block text-sm font-bold text-[#0a2e2c]">
                Number of Questions
              </label>
              <select
                id="questionCount"
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
                className="w-full rounded-xl border border-[#cfe6ee] bg-[#f7fcfe] px-3 py-2.5 text-sm font-semibold text-[#0a2e2c] outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/20"
              >
                {QUESTION_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </div>

            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-2xl bg-[#0a2e2c] px-4 py-3.5 text-[15px] font-extrabold text-white shadow-[0_8px_18px_rgba(10,46,44,0.28)] transition hover:bg-[#072422] hover:shadow-[0_10px_22px_rgba(10,46,44,0.34)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Starting...' : 'Start Mock Interview'}
            </button>
          </form>
        </div>
      </div>
    </CandidateAppShell>
  );
}
