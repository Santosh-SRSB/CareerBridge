'use client';

import { userFacingError } from '@/lib/client-errors';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { InterviewBotFace } from '@/components/interviews/InterviewBotFace';
import { JobRoleCombobox } from '@/components/marketplace/JobRoleCombobox';
import { createLiveInterview, getCandidateMe, getJobRoles, startLiveInterview } from '@/lib/api';
import { detectRoleCategory, uniqueRoles } from '@careerbridge/shared';
import '../candidate-interviews.css';

const QUESTION_COUNTS = [5, 10, 15];
const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];
const ROLES_ERROR = 'Unable to load job roles. Please try again.';

function PulseBackdrop() {
  return (
    <svg className="iv-art-pulse" viewBox="0 0 320 64" fill="none" aria-hidden preserveAspectRatio="none">
      <path
        d="M0 32h48l10-14 12 28 14-36 16 40 12-22 10 14H320"
        stroke="#b9c6ff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0 36h56l8-10 10 20 12-26 14 28 10-16 8 10H320"
        stroke="#d5ddff"
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

  const [jobRole, setJobRole] = useState(roleFromUrl);
  const [interviewType, setInterviewType] = useState<'GENERIC' | 'ROLE'>('ROLE');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('Intermediate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleError, setRoleError] = useState('');
  const [roleOptions, setRoleOptions] = useState<string[]>(roleFromUrl ? [roleFromUrl] : []);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState('');
  const [rolesAttempt, setRolesAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setRolesLoading(true);
    setRolesError('');
    Promise.all([getJobRoles(), getCandidateMe().catch(() => null)])
      .then(([roles, profile]) => {
        if (!active) return;
        const fromProfile = (profile?.careerInterests || []).filter(Boolean);
        const category = detectRoleCategory(fromProfile);
        const otherCatalog = Object.entries(roles.catalog)
          .filter(([key]) => key !== category)
          .flatMap(([, list]) => list);
        setRoleOptions(
          uniqueRoles([roleFromUrl, ...fromProfile, ...(roles.catalog[category] || []), ...roles.fromJobs, ...otherCatalog]),
        );
        setJobRole((current) => current || roleFromUrl || fromProfile[0] || '');
      })
      .catch(() => {
        if (active) setRolesError(ROLES_ERROR);
      })
      .finally(() => {
        if (active) setRolesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roleFromUrl, rolesAttempt]);

  const durationLimitMin = useMemo(() => Math.max(45, questionCount * 6), [questionCount]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const role = jobRole.trim();
    if (role.length < 2) {
      setRoleError('Please select a job role');
      return;
    }

    setRoleError('');
    setLoading(true);
    setError('');
    try {
      const session = await createLiveInterview({
        jobRole: role,
        interviewType: interviewType === 'GENERIC' ? 'BEHAVIOURAL' : 'ROLE',
        difficulty,
        questionCount,
        durationLimitMin,
        source: 'PASSPORT',
      });
      await startLiveInterview(session.id);
      router.push(`/interviews/mock/${session.id}`);
    } catch (err) {
      setError(userFacingError(err, 'start interview'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <CandidateAppShell activeTab="interviews" maxWidth="max-w-5xl">
      <div className="iv">
        <div className="iv-panel">
          <Link href="/interviews" className="iv-back">
            <span aria-hidden>←</span>
            My Interviews
          </Link>

          <div className="iv-head">
            <h1 className="iv-h1">AI Mock Interview</h1>
            <p className="iv-sub">
              {roleFromUrl ? (
                <>
                  Practising for <b>{roleFromUrl}</b>.
                </>
              ) : (
                'Practise with your AI Interviewer before the real thing.'
              )}
            </p>
          </div>

          <div className="iv-setup">
            <aside className="iv-left">
              <div className="iv-art">
                <PulseBackdrop />
                <InterviewBotFace size="xl" />
              </div>

              <div className="iv-card">
                <p className="iv-note">
                  <b>Note:</b> This interview is for your betterment. Scores are not linked to any job
                  application — please don’t cheat. Answer honestly so you can improve.
                </p>
              </div>
            </aside>

            <form onSubmit={(event) => void onSubmit(event)} className="iv-card iv-form">
              <div>
                <JobRoleCombobox
                  value={jobRole}
                  options={roleOptions}
                  onChange={(next) => {
                    setJobRole(next);
                    if (next.trim().length >= 2) setRoleError('');
                  }}
                  showHint={false}
                  required
                  loading={rolesLoading}
                  invalid={Boolean(roleError)}
                  describedBy={roleError ? 'mock-role-error' : rolesError ? 'mock-roles-load-error' : undefined}
                />
                {roleError ? (
                  <p id="mock-role-error" role="alert" className="iv-err">
                    {roleError}
                  </p>
                ) : null}
                {rolesError ? (
                  <p id="mock-roles-load-error" role="alert" className="iv-err">
                    {rolesError}{' '}
                    <button type="button" onClick={() => setRolesAttempt((n) => n + 1)}>
                      Retry
                    </button>
                    <small>You can still type your job role.</small>
                  </p>
                ) : null}
              </div>

              <fieldset className="m-0 border-0 p-0">
                <legend className="iv-lbl">Interview Type</legend>
                <label className="iv-opt">
                  <input
                    type="radio"
                    name="interviewType"
                    checked={interviewType === 'ROLE'}
                    onChange={() => setInterviewType('ROLE')}
                  />
                  <span>
                    <span className="iv-opt-title">Role Specific</span>
                    <span className="iv-opt-text">
                      Uses your resume, profile, skills, projects, and selected job role automatically.
                    </span>
                  </span>
                </label>
                <label className="iv-opt">
                  <input
                    type="radio"
                    name="interviewType"
                    checked={interviewType === 'GENERIC'}
                    onChange={() => setInterviewType('GENERIC')}
                  />
                  <span>
                    <span className="iv-opt-title">Generic</span>
                    <span className="iv-opt-text">
                      Communication, behavioural, and professional readiness — not purely technical.
                    </span>
                  </span>
                </label>
              </fieldset>

              <fieldset className="m-0 border-0 p-0">
                <legend className="iv-lbl">Difficulty Level</legend>
                <div className="iv-seg">
                  {DIFFICULTIES.map((level) => (
                    <label key={level}>
                      <input
                        type="radio"
                        name="difficulty"
                        value={level}
                        checked={difficulty === level}
                        onChange={() => setDifficulty(level)}
                      />
                      {level}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="questionCount" className="iv-lbl">
                  Number of Questions
                </label>
                <select
                  id="questionCount"
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                  className="iv-field"
                >
                  {QUESTION_COUNTS.map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </div>

              {error ? (
                <p role="alert" className="iv-err">
                  {error}
                </p>
              ) : null}

              <button type="submit" disabled={loading} className="iv-btn iv-btn--full">
                {loading ? 'Starting...' : 'Start Mock Interview'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </CandidateAppShell>
  );
}
