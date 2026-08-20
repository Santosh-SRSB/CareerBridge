'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ApplicationRecord, CandidateProfile, JobCard, ProfileCompletion } from '@careerbridge/shared';
import {
  fetchMe,
  getCandidateMe,
  getProfileCompletion,
  listApplications,
  listInterviews,
  listResumes,
  logout,
  recommendedJobs,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/AppNav';
import { CandidateTopBar, ProfileRail } from '@/components/CandidatePortal';
import { JobFeedCard } from '@/components/JobListingCard';
import { ScoreRing } from '@/components/ScoreRing';
import { SkillEntryCard } from '@/components/SkillEntryCard';

function DashboardSkeleton() {
  return (
    <div className="cb-portal-page">
      <div className="cb-portal-wrap">
        <p className="text-sm text-muted">Loading your Career Passport...</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState('there');
  const [city, setCity] = useState('');
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [resumeScore, setResumeScore] = useState<number | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const [interviewScore, setInterviewScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(async (user) => {
        if (!user.onboardingCompleted) {
          router.replace('/onboarding');
          return;
        }
        const [nextProfile, nextCompletion, recommended, resumes, interviews, nextApplications] = await Promise.all([
          getCandidateMe(),
          getProfileCompletion(),
          recommendedJobs().catch(() => ({ items: [] as JobCard[] })),
          listResumes().catch(() => []),
          listInterviews().catch(() => []),
          listApplications().catch(() => [] as ApplicationRecord[]),
        ]);
        const displayName = [nextProfile.firstName, nextProfile.lastName].filter(Boolean).join(' ')
          || user.firstName
          || 'there';
        setName(displayName);
        setCity(nextProfile.city || '');
        setProfile(nextProfile);
        setCompletion(nextCompletion);
        setJobs(recommended.items.slice(0, 6));
        setHasResume(resumes.length > 0);
        setResumeScore(resumes[0]?.score ?? null);
        const done = interviews.find((item) => item.status === 'COMPLETED' && item.score != null);
        setInterviewScore(done?.score ?? null);
        setApplications(nextApplications);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <DashboardSkeleton />;
  if (!completion) {
    return (
      <main className="cb-app">
        <p className="font-semibold text-primary">Something went wrong.</p>
        <p className="mt-2 text-muted">Your information is safe. Please try again.</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </main>
    );
  }

  const improve = completion.sections.filter((item) => !item.done).slice(0, 3);
  const latestApplications = applications.slice(0, 3);
  const headlineSkill = profile?.skills[0]?.name;

  async function signOut() {
    await logout();
    router.replace('/');
  }

  return (
    <div className="cb-portal-page">
      <CandidateTopBar name={name} onSignOut={signOut} />
      <div className="cb-portal-wrap grid items-start gap-3 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        <div className="hidden lg:block">
          <ProfileRail
            name={name}
            city={city}
            percentage={completion.percentage}
            skills={profile?.skills.map((item) => item.name) ?? []}
            resumeScore={resumeScore}
            interviewScore={interviewScore}
            passportId={profile?.id ? `CB-${profile.id.slice(-4).toUpperCase()}` : 'CB-0000'}
            photoUrl={profile?.photoUrl}
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="lg:hidden">
            <ProfileRail
              name={name}
              city={city}
              percentage={completion.percentage}
              skills={profile?.skills.map((item) => item.name) ?? []}
              resumeScore={resumeScore}
              interviewScore={interviewScore}
              passportId={profile?.id ? `CB-${profile.id.slice(-4).toUpperCase()}` : 'CB-0000'}
              photoUrl={profile?.photoUrl}
              showNav={false}
            />
          </div>
          <section className="cb-hero-pop cb-dash-hero relative p-4 sm:p-7">
            <p className="relative z-10 inline-flex items-center rounded-pill bg-[#1ec8c0] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#0c3340] sm:text-[11px]">
              Free for Candidate
            </p>
            <h1 className="relative z-10 mt-3 text-[26px] font-extrabold tracking-tight text-white sm:mt-4 sm:text-[34px] sm:leading-tight">
              You&apos;re {completion.percentage}% ready.
              <span className="mt-1 block text-teal">Build your future.</span>
            </h1>
            <p className="relative z-10 mt-3 max-w-xl text-sm leading-6 text-white/70">
              {completion.percentage < 100
                ? 'Finish the remaining sections so employers can find the right match for you.'
                : 'Your Career Passport is ready. Explore jobs or practise an interview next.'}
            </p>
            <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
              <Link
                href="/jobs"
                className="inline-flex h-8 items-center rounded-full bg-[#1ec8c0] px-3.5 text-xs font-extrabold text-[#0c3340] transition hover:brightness-110"
              >
                Explore Jobs
              </Link>
              <Link
                href="/interviews"
                className="inline-flex h-8 items-center rounded-full border border-white/25 px-3.5 text-xs font-bold text-white transition hover:bg-white/10"
              >
                Practice interview
              </Link>
            </div>
            <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
              <div className="cb-hero-stat">
                <p>Ready</p>
                <strong>{completion.percentage}%</strong>
              </div>
              <div className="cb-hero-stat">
                <p>Resume</p>
                <strong>{resumeScore ?? '—'}</strong>
              </div>
              <div className="cb-hero-stat">
                <p>Applied</p>
                <strong>{applications.length}</strong>
              </div>
            </div>
          </section>

          <section className="cb-dash-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="min-w-0 text-base font-bold text-primary sm:text-lg">Recommended jobs</h2>
              <Link href="/jobs" className="shrink-0 text-sm font-bold text-teal hover:underline">
                View all
              </Link>
            </div>
            {jobs.length ? (
              <div className="cb-job-feed mt-4">
                {jobs.map((job) => (
                  <JobFeedCard key={job.id} job={job} cityFallback={city} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Jobs will appear here as soon as they match your Career Passport.</p>
            )}
          </section>

          <section className="cb-dash-card p-4 sm:p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="min-w-0 text-base font-bold text-primary sm:text-lg">Choose how to practise</h2>
              <p className="text-xs font-semibold text-muted">Mock interview and skill assessment are separate.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Link href="/resume" className="cb-lift-card p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-teal">Resume</p>
                <div className="mt-3 flex items-center gap-3">
                  <ScoreRing value={resumeScore ?? 0} size={64} label="Score" />
                  <div className="min-w-0">
                    <p className="font-bold text-primary">{hasResume ? 'Improve your resume' : 'Create your first resume'}</p>
                    <p className="mt-1 text-sm text-muted">Built from your Career Passport.</p>
                  </div>
                </div>
              </Link>
              <Link href="/interviews" className="cb-lift-card p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-teal">Mock interview</p>
                <div className="mt-3 flex items-center gap-3">
                  <ScoreRing value={interviewScore ?? 0} size={64} label="Score" />
                  <div className="min-w-0">
                    <p className="font-bold text-primary">Go for a mock interview</p>
                    <p className="mt-1 text-sm text-muted">
                      {headlineSkill ? `Practice interview questions around ${headlineSkill}.` : 'Practice answers and get feedback.'}
                    </p>
                  </div>
                </div>
              </Link>
              <SkillEntryCard className="sm:col-span-2 xl:col-span-1" />
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-3 lg:col-span-2 xl:col-span-1">
          <section className="cb-dash-card p-4 sm:p-5">
            <h2 className="text-lg font-bold text-primary">What to do next</h2>
            <ul className="mt-4 space-y-2">
              {improve.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="cb-side-action">
                    <span className="text-sm font-semibold text-primary">
                      {item.label.startsWith('Add') ? item.label : `Add ${item.label.toLowerCase()}`}
                    </span>
                    <span className="rounded-pill bg-[#1ec8c0] px-3 py-1 text-xs font-bold text-[#0c3340]">Add</span>
                  </Link>
                </li>
              ))}
              {!hasResume ? (
                <li>
                  <Link href="/resume" className="cb-side-action">
                    <span className="text-sm font-semibold text-primary">Create your first resume</span>
                    <span className="rounded-pill bg-[#1ec8c0] px-3 py-1 text-xs font-bold text-[#0c3340]">Start</span>
                  </Link>
                </li>
              ) : null}
              {!improve.length && hasResume ? (
                <li className="rounded-xl bg-[#f4f8f8] px-3 py-3 text-sm text-muted">
                  Your Career Passport is in good shape. Explore jobs next.
                </li>
              ) : null}
            </ul>
          </section>

          <section className="cb-dash-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="min-w-0 text-base font-bold text-primary sm:text-lg">Applications</h2>
              <Link href="/applications" className="shrink-0 text-sm font-bold text-teal hover:underline">
                View all
              </Link>
            </div>
            {latestApplications.length ? (
              <div className="mt-4 space-y-2">
                {latestApplications.map((item) => (
                  <Link key={item.id} href={`/applications/${item.id}`} className="cb-app-row">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 font-bold text-primary">{item.job.title}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted">{item.job.companyName}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">You haven&apos;t applied yet. Explore jobs to get started.</p>
            )}
          </section>

          <section className="cb-dash-card overflow-hidden p-4 sm:p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-teal">For candidates</p>
            <p className="mt-2 text-sm font-extrabold text-primary">CareerBridge is free for candidates.</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Never pay anyone to get a job. Employers pay to hire — your Career Passport stays yours.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
