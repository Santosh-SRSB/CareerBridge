'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCandidateMe,
  getProfileCompletion,
  listApplications,
  listJobs,
  listResumes,
  recommendedJobs,
  fetchMe,
  updateCandidateMe,
} from '@/lib/api';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import type { CandidateProfile, JobCard } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { formatCandidateExperienceLine } from '@/lib/format-candidate-experience';
import { resolvePassportSummary } from '@/lib/passport-to-friend-resume';
import {
  fetchScheduledInterviews,
  type ScheduledJobInterview,
} from '@/lib/candidate-marketplace-api';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';

function formatPersonName(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatSalaryShort(min?: number | null, max?: number | null) {
  if (!min && !max) return 'Salary not listed';
  const fmt = (value: number) => {
    if (value >= 1000) return `₹${Math.round(value / 1000)}K`;
    return `₹${value.toLocaleString('en-IN')}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function formatExperienceField(profile: CandidateProfile | null) {
  if (!profile) return '—';
  const years = profile.totalExperienceYears ?? 0;
  const months = profile.totalExperienceMonths ?? 0;
  const total = years + months / 12;
  if (!profile.hasExperience || profile.hasExperience === 'no' || total < 1) {
    if (profile.experienceLevel === 'fresher' || !profile.experiences?.length) return 'Fresher';
  }
  if (total >= 1) {
    const rounded = Math.floor(total);
    return rounded <= 1 ? '1+ Year' : `${rounded}+ Years`;
  }
  return formatCandidateExperienceLine(profile) || 'Fresher';
}

function statusLabel(profile: CandidateProfile | null) {
  if (!profile) return 'CANDIDATE';
  const years = profile.totalExperienceYears ?? 0;
  const months = profile.totalExperienceMonths ?? 0;
  if ((years + months / 12) < 1 || profile.experienceLevel === 'fresher') return 'FRESHER';
  return 'EXPERIENCED';
}

function targetRole(profile: CandidateProfile | null) {
  if (!profile) return 'YOUR ROLE';
  const interest = profile.careerInterests?.[0]?.trim();
  if (interest) return interest.toUpperCase();
  const latest =
    profile.experiences?.find((item) => item.stillInCompany) || profile.experiences?.[0];
  if (latest?.jobTitle) return latest.jobTitle.toUpperCase();
  return 'YOUR ROLE';
}

function currentCompany(profile: CandidateProfile | null) {
  if (!profile?.experiences?.length) return '—';
  const current =
    profile.experiences.find((item) => item.stillInCompany) ||
    profile.experiences.find((item) => !item.endDate) ||
    profile.experiences[0];
  return current?.company || '—';
}

function formatInterviewDate(value: string) {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function interviewStatusLabel(status: ScheduledJobInterview['status']) {
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'RESCHEDULE_REQUESTED') return 'Reschedule requested';
  return 'Pending confirmation';
}

function TypingHello({ name }: { name: string }) {
  const fullText = `Hello, ${name}`;
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pause' | 'deleting'>('typing');

  useEffect(() => {
    setDisplayed('');
    setPhase('typing');
  }, [fullText]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (displayed.length < fullText.length) {
        timer = setTimeout(() => {
          setDisplayed(fullText.slice(0, displayed.length + 1));
        }, 95);
      } else {
        timer = setTimeout(() => setPhase('pause'), 1400);
      }
    } else if (phase === 'pause') {
      timer = setTimeout(() => setPhase('deleting'), 400);
    } else if (displayed.length > 0) {
      timer = setTimeout(() => {
        setDisplayed(fullText.slice(0, displayed.length - 1));
      }, 45);
    } else {
      timer = setTimeout(() => setPhase('typing'), 350);
    }

    return () => clearTimeout(timer);
  }, [displayed, phase, fullText]);

  return (
    <h1 className="cb-boarding__hello" aria-label={fullText}>
      <span className="cb-boarding__hello-ghost" aria-hidden>
        {fullText}
      </span>
      <span className="cb-boarding__hello-live">
        <span className="cb-boarding__hello-typed">{displayed}</span>
        <span className="cb-boarding__hello-caret" aria-hidden />
      </span>
    </h1>
  );
}

function ProfileCompletedRing({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, Math.round(value)));
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="cb-boarding__ring" title={`${safe}% profile completed`}>
      <div className="cb-boarding__ring-visual">
        <svg className="cb-boarding__ring-svg" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={radius} className="cb-boarding__ring-track" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="cb-boarding__ring-fill"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="cb-boarding__ring-num">{safe}%</span>
      </div>
      <span className="cb-boarding__ring-lbl">Profile Completed</span>
    </div>
  );
}

const EXPERIENCE_LEVEL_CHIPS = [
  { key: 'fresher', label: 'Fresher' },
  { key: '0-1', label: '0–1 Yr' },
  { key: '1-3', label: '1–3 Yrs' },
  { key: '3-5', label: '3–5 Yrs' },
  { key: '5+', label: '5+ Yrs' },
] as const;

function activeExperienceChip(profile: CandidateProfile | null) {
  if (!profile) return 'fresher';
  const years = profile.totalExperienceYears ?? 0;
  const months = profile.totalExperienceMonths ?? 0;
  const total = years + months / 12;
  if (profile.experienceLevel === 'fresher' || total < 1) return 'fresher';
  if (total < 1.5) return '0-1';
  if (total < 3.5) return '1-3';
  if (total < 5.5) return '3-5';
  return '5+';
}

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState('there');
  const [city, setCity] = useState('');
  const [completionPercent, setCompletionPercent] = useState(0);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [bio, setBio] = useState('');
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledJobInterview[]>([]);
  const [applicationCount, setApplicationCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }
    if (stored.role === 'EMPLOYER_ADMIN' || stored.role === 'EMPLOYER_RECRUITER') {
      router.replace('/employer');
      return;
    }

    fetchMe()
      .then((me) => {
        const onboardingDone = me.onboardingCompleted ?? stored.onboardingCompleted;
        const dashboardReached = me.dashboardReached ?? stored.dashboardReached ?? false;
        patchStoredUser({
          firstName: me.firstName ?? stored.firstName,
          onboardingCompleted: onboardingDone,
          dashboardReached,
        });
        if (!onboardingDone) {
          router.replace('/onboarding/continue');
          return;
        }

        setName(formatPersonName(me.firstName || stored.firstName || 'there'));
        setReady(true);

        const markDashboard = dashboardReached
          ? Promise.resolve()
          : updateCandidateMe({ dashboardReached: true })
              .then(() => patchStoredUser({ dashboardReached: true }))
              .catch(() => undefined);

        return Promise.all([
          markDashboard,
          getCandidateMe(),
          getProfileCompletion(),
          recommendedJobs()
            .then((result) => result.items || [])
            .catch(() => listJobs({ limit: 8 }).then((result) => result.items || []).catch(() => [])),
          fetchScheduledInterviews().catch(() => [] as ScheduledJobInterview[]),
          listApplications()
            .then((rows) => rows.length)
            .catch(() => 0),
          listResumes()
            .then((items) => {
              const latest = [...items].sort(
                (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
              )[0];
              return latest?.summary || latest?.content?.summary || '';
            })
            .catch(() => ''),
        ]).then(([, candidateProfile, completion, jobItems, interviews, appsCount, resumeSummary]) => {
          setProfile(candidateProfile);
          setName(formatPersonName(candidateProfile.firstName || me.firstName || stored.firstName || 'there'));
          setCity(candidateProfile.city || candidateProfile.preferredWorkCity || '');
          const percent = completion?.percentage ?? candidateProfile.profileCompletion ?? 0;
          setCompletionPercent(percent);
          setBio(resolvePassportSummary(candidateProfile, resumeSummary || undefined));
          setJobs(jobItems.slice(0, 3));
          const upcoming = interviews
            .filter((item) => item.status !== 'RESCHEDULE_REQUESTED')
            .sort((a, b) =>
              `${a.scheduledDate}${a.scheduledTime}`.localeCompare(`${b.scheduledDate}${b.scheduledTime}`),
            );
          setScheduledInterviews(upcoming);
          setApplicationCount(appsCount);
        });
      })
      .catch(() => {
        if (!stored.onboardingCompleted) {
          router.replace('/onboarding/continue');
          return;
        }
        setName(formatPersonName(stored.firstName || 'there'));
        setReady(true);
      });
  }, [router]);

  const fullName = useMemo(() => {
    if (!profile) return formatPersonName(name);
    return (
      formatPersonName([profile.firstName, profile.lastName].filter(Boolean).join(' ')) ||
      formatPersonName(name)
    );
  }, [profile, name]);

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 1)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const skillsCount = profile?.skills?.length || 0;
  const isProfileComplete = completionPercent >= 100;
  const displayInterviews = scheduledInterviews.slice(0, 3);
  const experienceChip = activeExperienceChip(profile);

  if (!ready) {
    return (
      <CandidateAppShell activeTab="home" maxWidth="max-w-[1180px]">
        <div className="p-12 text-center text-sm text-slate-500">Loading dashboard...</div>
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell activeTab="home" maxWidth="max-w-[1180px]" avatarUrl={profile?.photoUrl}>
      <div className="cb-boarding">
        <div className="cb-boarding__greet">
          <p className="cb-boarding__eyebrow">BOARDING · CAREER JOURNEY</p>
          <TypingHello name={name} />
          <p className="cb-boarding__sub">
            {isProfileComplete
              ? 'Welcome back. Your check-in is complete — explore stronger job matches below.'
              : 'Welcome back. Finish check-in on your profile to board better job matches.'}
          </p>
        </div>

        <div className="cb-boarding__ticket">
          <div className="cb-boarding__ticket-main">
            <div className="cb-boarding__route">
              <div>
                <div className="cb-boarding__city">{statusLabel(profile)}</div>
                <div className="cb-boarding__code">STATUS</div>
              </div>
              <div className="cb-boarding__plane" aria-hidden>
                <p className="cb-boarding__plane-title">Career Passport</p>
                <div className="cb-boarding__plane-line">
                  <span className="cb-boarding__plane-icon">✈</span>
                </div>
              </div>
              <div>
                <div className="cb-boarding__city cb-boarding__city--target">{targetRole(profile)}</div>
                <div className="cb-boarding__code">TARGET ROLE</div>
              </div>
            </div>

            <div className="cb-boarding__level-row">
              <div className="cb-boarding__field-label">LEVEL</div>
              <div className="cb-boarding__chips">
                {EXPERIENCE_LEVEL_CHIPS.map((chip) => (
                  <span
                    key={chip.key}
                    className={`cb-boarding__chip${experienceChip === chip.key ? ' is-active' : ''}`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="cb-boarding__fields">
              <div>
                <div className="cb-boarding__field-label">PASSENGER</div>
                <div className="cb-boarding__field-val">{fullName}</div>
              </div>
              <div>
                <div className="cb-boarding__field-label">FROM</div>
                <div className="cb-boarding__field-val">{city || '—'}</div>
              </div>
              <div>
                <div className="cb-boarding__field-label">COMPANY</div>
                <div className="cb-boarding__field-val">{currentCompany(profile)}</div>
              </div>
              <div>
                <div className="cb-boarding__field-label">EXPERIENCE</div>
                <div className="cb-boarding__field-val">{formatExperienceField(profile)}</div>
              </div>
            </div>

            <div className="cb-boarding__progress">
              <div className="cb-boarding__progress-label">
                <span>Check-in progress</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="cb-boarding__progress-track">
                <div
                  className="cb-boarding__progress-fill"
                  style={{ width: `${Math.min(100, Math.max(0, completionPercent))}%` }}
                />
              </div>
            </div>

            {!isProfileComplete ? (
              <button
                type="button"
                className="cb-boarding__btn"
                onClick={() => router.push('/profile')}
              >
                Complete Profile
              </button>
            ) : (
              <button
                type="button"
                className="cb-boarding__btn"
                onClick={() => router.push('/jobs')}
              >
                Browse Jobs
              </button>
            )}
          </div>

          <div className="cb-boarding__stub">
            <div className="cb-boarding__stub-top">
              <span>CAREER PASSPORT</span>
              <span className="cb-boarding__tag">FREE</span>
            </div>
            <div className="cb-boarding__id-row">
              <div className="cb-boarding__id-photo">
                {profile?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photoUrl} alt="" />
                ) : (
                  initials || 'C'
                )}
              </div>
              <div className="cb-boarding__id-meta">
                <div className="cb-boarding__id-name">{fullName}</div>
                <div className="cb-boarding__id-loc">{city || 'India'}</div>
              </div>
              <ProfileCompletedRing value={completionPercent} />
            </div>

            <div className="cb-boarding__summary">
              <div className="cb-boarding__summary-label">SUMMARY</div>
              <p className="cb-boarding__bio">
                {bio || 'Complete your profile to unlock a stronger career summary.'}
              </p>
            </div>

            <button
              type="button"
              className="cb-boarding__stub-btn"
              onClick={() => router.push('/profile')}
            >
              View Profile
            </button>
          </div>
        </div>

        <div className="cb-boarding__stats">
          <div className="cb-boarding__stat">
            <div className="cb-boarding__stat-num">{completionPercent}%</div>
            <div className="cb-boarding__stat-lbl">STRENGTH</div>
          </div>
          <div className="cb-boarding__stat">
            <div className="cb-boarding__stat-num">{skillsCount}</div>
            <div className="cb-boarding__stat-lbl">SKILLS</div>
          </div>
          <div className="cb-boarding__stat">
            <div className="cb-boarding__stat-num">{scheduledInterviews.length}</div>
            <div className="cb-boarding__stat-lbl">INTERVIEWS</div>
          </div>
          <div className="cb-boarding__stat">
            <div className="cb-boarding__stat-num">{applicationCount}</div>
            <div className="cb-boarding__stat-lbl">APPLICATIONS</div>
          </div>
        </div>

        <div className="cb-boarding__section-title">
          <h2>Recommended Jobs</h2>
          <button type="button" onClick={() => router.push('/jobs')}>
            View all jobs →
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="cb-boarding__empty">
            <p>No recommended jobs yet. Browse the marketplace to explore openings.</p>
            <button type="button" className="cb-boarding__btn" onClick={() => router.push('/jobs')}>
              Browse jobs
            </button>
          </div>
        ) : (
          <div className="cb-boarding__jobs">
            {jobs.map((job) => (
              <article key={job.id} className="cb-boarding__job">
                <h3>{job.title}</h3>
                <div className="cb-boarding__job-co">
                  {job.companyName} · {job.city || city || 'India'}
                </div>
                <div className="cb-boarding__job-pay">
                  {formatSalaryShort(job.salaryMin, job.salaryMax)}
                </div>
                <div className="cb-boarding__job-match">
                  {typeof job.match?.score === 'number' ? `${job.match.score}% MATCH` : 'RECOMMENDED'}
                </div>
                <div className="cb-boarding__job-actions">
                  <button
                    type="button"
                    className="cb-boarding__job-view"
                    onClick={() => router.push(`/jobs/${job.id}`)}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="cb-boarding__job-apply"
                    onClick={() => router.push(`/jobs/${job.id}/apply`)}
                  >
                    Apply
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="cb-boarding__section-title cb-boarding__section-title--spaced">
          <h2>Scheduled Interviews</h2>
          <button type="button" onClick={() => router.push('/interviews')}>
            View all interviews →
          </button>
        </div>

        {displayInterviews.length === 0 ? (
          <div className="cb-boarding__empty">
            <p>No interviews scheduled yet. Practice a mock interview while you wait.</p>
            <div className="cb-boarding__empty-actions">
              <button
                type="button"
                className="cb-boarding__job-view"
                onClick={() => router.push('/applications')}
              >
                Track applications
              </button>
              <button
                type="button"
                className="cb-boarding__job-apply"
                onClick={() => router.push('/interviews/mock')}
              >
                Practice mock interview
              </button>
            </div>
          </div>
        ) : (
          <div className="cb-boarding__jobs">
            {displayInterviews.map((interview) => (
              <article key={interview.id} className="cb-boarding__job">
                <h3>{interview.jobTitle}</h3>
                <div className="cb-boarding__job-co">{interview.companyName}</div>
                <div className="cb-boarding__job-pay">{formatInterviewDate(interview.scheduledDate)}</div>
                <div className="cb-boarding__job-match">{interviewStatusLabel(interview.status).toUpperCase()}</div>
                <div className="cb-boarding__job-actions">
                  <button
                    type="button"
                    className="cb-boarding__job-view"
                    onClick={() => router.push(`/interviews/scheduled/${interview.id}`)}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="cb-boarding__job-apply"
                    onClick={() => router.push(mockInterviewSetupUrl(interview.jobTitle))}
                  >
                    Prepare
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </CandidateAppShell>
  );
}
