'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import { JobRoleCombobox } from '@/components/marketplace/JobRoleCombobox';
import { Button } from '@/components/ui/Button';
import { createLiveInterview, getCandidateMe, startLiveInterview } from '@/lib/api';

const DEFAULT_JOB_ROLES = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Software Developer',
  'Data Analyst',
  'Customer Service Executive',
  'Front Office Executive',
  'Retail Associate',
  'Sales Executive',
  'HR Executive',
  'Marketing Executive',
  'Business Analyst',
];

const QUESTION_COUNTS = [5, 8, 10];

export default function MockInterviewSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get('role')?.trim() || '';

  const [jobRole, setJobRole] = useState(roleFromUrl || DEFAULT_JOB_ROLES[0]);
  const [interviewType, setInterviewType] = useState<'GENERIC' | 'ROLE'>(roleFromUrl ? 'ROLE' : 'GENERIC');
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleOptions, setRoleOptions] = useState(DEFAULT_JOB_ROLES);

  useEffect(() => {
    void getCandidateMe()
      .then((profile) => {
        const fromProfile = (profile.careerInterests || []).filter(Boolean);
        const merged = [...new Set([roleFromUrl, ...fromProfile, ...DEFAULT_JOB_ROLES].filter(Boolean))];
        setRoleOptions(merged);
        if (roleFromUrl) {
          setJobRole(roleFromUrl);
        } else if (fromProfile[0]) {
          setJobRole(fromProfile[0]);
        }
      })
      .catch(() => {
        setRoleOptions(roleFromUrl ? [roleFromUrl, ...DEFAULT_JOB_ROLES] : DEFAULT_JOB_ROLES);
        if (roleFromUrl) setJobRole(roleFromUrl);
      });
  }, [roleFromUrl]);

  const durationLimitMin = useMemo(() => Math.max(45, questionCount * 6), [questionCount]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const role = jobRole.trim();
    if (role.length < 2) {
      setError('Please enter a job role.');
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
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-3xl">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <Link href="/interviews" className="text-sm font-bold text-[#0a2e2c] hover:underline">
          ← My Interviews
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <InterviewBotFace size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">AI Mock Interview</h1>
            {roleFromUrl ? (
              <p className="mt-1 text-sm text-slate-600">
                Practising for <span className="font-bold text-slate-900">{roleFromUrl}</span>. You can change the role
                below.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">Practise with your AI interviewer before the real thing.</p>
            )}
          </div>
        </div>

        <form onSubmit={(event) => void onSubmit(event)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <JobRoleCombobox value={jobRole} options={roleOptions} onChange={setJobRole} />

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-slate-800">Interview Type</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="radio"
                  name="interviewType"
                  checked={interviewType === 'GENERIC'}
                  onChange={() => setInterviewType('GENERIC')}
                />
                Generic
              </label>
              <p className="ml-6 text-xs text-slate-500">
                Communication, behavioural, and professional readiness — not purely technical.
              </p>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="radio"
                  name="interviewType"
                  checked={interviewType === 'ROLE'}
                  onChange={() => setInterviewType('ROLE')}
                />
                Role-Based
              </label>
              <p className="ml-6 text-xs text-slate-500">
                Uses your resume, profile, skills, projects, and selected job role automatically.
              </p>
            </div>
          </fieldset>

          <div>
            <label htmlFor="questionCount" className="mb-2 block text-sm font-bold text-slate-800">
              Number of Questions
            </label>
            <select
              id="questionCount"
              value={questionCount}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800"
            >
              {QUESTION_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" loading={loading} loadingLabel="Starting..." className="w-full">
            Start Mock Interview
          </Button>
        </form>
      </div>
    </CandidateAppShell>
  );
}
