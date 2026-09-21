'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { photoFileError } from '@careerbridge/shared';
import {
  getCandidateMe,
  getProfileCompletion,
  listApplications,
  listJobs,
  listResumes,
  recommendedJobs,
  fetchMe,
  updateCandidateMe,
  uploadCandidatePhoto,
} from '@/lib/api';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import type { CandidateProfile, JobCard } from '@careerbridge/shared';
import {
  experienceYearsTotal,
  formatLocationLabel,
  resolveCandidateExperienceBand,
  resolveExperienceChip,
} from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { formatCandidateExperienceLine } from '@/lib/format-candidate-experience';
import { resolvePassportSummary } from '@/lib/passport-to-friend-resume';
import {
  fetchScheduledInterviews,
  type ScheduledJobInterview,
} from '@/lib/candidate-marketplace-api';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';
import { compressImageBlob } from '@/lib/image';

const PHOTO_ACCEPT = 'image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png';

function formatPersonName(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatExperienceField(profile: CandidateProfile | null) {
  if (!profile) return '—';
  const band = resolveCandidateExperienceBand(profile);
  if (band === 'fresher') {
    const internship = profile.experiences?.find((item) => item.isInternship);
    if (internship?.company) return `Internship · ${internship.company}`;
    if (profile.hasExperience === 'INTERNSHIP' && profile.experiences?.[0]?.company) {
      return `Internship · ${profile.experiences[0].company}`;
    }
    return 'Fresher';
  }
  const total = experienceYearsTotal(profile);
  if (total >= 1) {
    const rounded = Math.floor(total);
    return rounded <= 1 ? '1+ Year' : `${rounded}+ Years`;
  }
  return formatCandidateExperienceLine(profile) || 'Experienced';
}

function statusLabel(profile: CandidateProfile | null) {
  if (!profile) return 'CANDIDATE';
  return resolveCandidateExperienceBand(profile) === 'fresher' ? 'FRESHER' : 'EXPERIENCED';
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
  if (!profile) return '—';
  const band = resolveCandidateExperienceBand(profile);
  if (band === 'fresher') {
    const internship =
      profile.experiences?.find((item) => item.isInternship) ||
      (profile.hasExperience === 'INTERNSHIP' ? profile.experiences?.[0] : undefined);
    return internship?.company || '—';
  }
  if (!profile.experiences?.length) return '—';
  const current =
    profile.experiences.find((item) => item.stillInCompany && !item.isInternship) ||
    profile.experiences.find((item) => !item.isInternship) ||
    profile.experiences.find((item) => item.stillInCompany) ||
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
  return resolveExperienceChip(profile);
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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPct, setPhotoPct] = useState(0);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    if (!photoUploading) return;
    setPhotoPct(8);
    const id = window.setInterval(() => {
      setPhotoPct((prev) => {
        if (prev >= 88) return prev;
        return prev + Math.max(2, Math.round((90 - prev) * 0.12));
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [photoUploading]);

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
          ...(me.photoUrl !== undefined ? { photoUrl: me.photoUrl } : {}),
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
          if (candidateProfile.photoUrl) {
            patchStoredUser({ photoUrl: candidateProfile.photoUrl });
          }
          setName(formatPersonName(candidateProfile.firstName || me.firstName || stored.firstName || 'there'));
          setCity(
            formatLocationLabel(candidateProfile.city || candidateProfile.preferredWorkCity || ''),
          );
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

  useEffect(() => {
    const onPhoto = (event: Event) => {
      const detail = (event as CustomEvent<{ photoUrl?: string | null }>).detail;
      if (!detail || !('photoUrl' in detail)) return;
      const url = detail.photoUrl ?? null;
      setProfile((prev) => (prev ? { ...prev, photoUrl: url } : prev));
      patchStoredUser({ photoUrl: url });
    };
    window.addEventListener('cb-photo-updated', onPhoto);
    return () => window.removeEventListener('cb-photo-updated', onPhoto);
  }, []);

  useEffect(() => {
    function refreshPhoto() {
      getCandidateMe()
        .then((candidateProfile) => {
          if (!candidateProfile.photoUrl) return;
          setProfile((prev) =>
            prev ? { ...prev, photoUrl: candidateProfile.photoUrl } : prev,
          );
          patchStoredUser({ photoUrl: candidateProfile.photoUrl });
        })
        .catch(() => undefined);
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshPhoto();
    };
    window.addEventListener('focus', refreshPhoto);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', refreshPhoto);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const fullName = useMemo(() => {
    if (!profile) return formatPersonName(name);
    return (
      formatPersonName([profile.firstName, profile.lastName].filter(Boolean).join(' ')) ||
      formatPersonName(name)
    );
  }, [profile, name]);

  function notifyPhotoUpdated(photoUrl: string | null) {
    patchStoredUser({ photoUrl });
    window.dispatchEvent(new CustomEvent('cb-photo-updated', { detail: { photoUrl } }));
  }

  async function onPickDashboardPhoto(file?: File) {
    if (!file || photoUploading) return;
    const invalid = photoFileError(file.type, file.size);
    if (invalid) {
      setPhotoError(invalid);
      return;
    }
    setPhotoError('');
    setPhotoUploading(true);
    setPhotoPct(10);
    try {
      const blob = await compressImageBlob(file, 420);
      setPhotoPct(55);
      const updated = await uploadCandidatePhoto(blob, 'photo.jpg');
      const nextUrl = updated.photoUrl;
      if (!nextUrl) throw new Error('Photo was not saved. Please try again.');
      setProfile((prev) => (prev ? { ...prev, photoUrl: nextUrl } : prev));
      notifyPhotoUpdated(nextUrl);
      setPhotoPct(100);
      await new Promise((r) => setTimeout(r, 280));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not upload that photo.');
    } finally {
      setPhotoUploading(false);
      setPhotoPct(0);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

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
              <button
                type="button"
                className={`cb-boarding__id-photo ${profile?.photoUrl ? '' : 'cb-boarding__id-photo--empty'}`}
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                aria-label={profile?.photoUrl ? 'Change profile photo' : 'Add profile photo'}
              >
                {profile?.photoUrl && !photoUploading ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      profile.photoUrl.startsWith('data:')
                        ? profile.photoUrl
                        : `${profile.photoUrl}${profile.photoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(profile.photoUrl.slice(-24))}`
                    }
                    alt=""
                  />
                ) : (
                  <span className="cb-boarding__id-photo-empty">
                    <span className="cb-boarding__id-photo-cam" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 8.5A2.5 2.5 0 016.5 6h2.1l1.2-1.8A1.5 1.5 0 0111 3.5h2a1.5 1.5 0 011.2.7L15.4 6h2.1A2.5 2.5 0 0120 8.5v9A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5v-9z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                        <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </span>
                    <span className="cb-boarding__id-photo-stripe">Add Photo</span>
                  </span>
                )}
                {photoUploading ? (
                  <span className="cb-boarding__id-photo-upload" aria-live="polite">
                    <span
                      className="cb-boarding__id-photo-water"
                      style={{ height: `${Math.max(12, photoPct)}%` }}
                    />
                    <span className="cb-boarding__id-photo-upload-txt">
                      {photoPct < 100 ? `${photoPct}%` : '✓'}
                    </span>
                  </span>
                ) : null}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept={PHOTO_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                disabled={photoUploading}
                onChange={(event) => void onPickDashboardPhoto(event.target.files?.[0])}
              />
              <div className="cb-boarding__id-meta">
                <div className="cb-boarding__id-name">{fullName}</div>
                <div className="cb-boarding__id-loc">{city || 'India'}</div>
                {photoError ? (
                  <div className="cb-boarding__id-photo-err">{photoError}</div>
                ) : null}
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
              onClick={() => router.push('/profile/details')}
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
          <div className="cb-rec-jobs">
            {jobs.map((job) => {
              const mark = (job.companyName || 'CB')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() || '')
                .join('');
              const skills = [...(job.requiredSkills || []), ...(job.preferredSkills || [])]
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((s, i, arr) => arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
                .slice(0, 5);
              const experienceLabel = job.experience?.trim() || null;
              return (
                <article key={job.id} className="cb-rec-job">
                  <div className="cb-rec-job__head">
                    <div className="cb-rec-job__brand">
                      <span className="cb-rec-job__logo" aria-hidden>
                        {mark || 'CB'}
                      </span>
                      <span className="cb-rec-job__company">{job.companyName}</span>
                    </div>
                    <span className="cb-rec-job__match">
                      {typeof job.match?.score === 'number'
                        ? `${job.match.score}% match`
                        : 'Recommended'}
                    </span>
                  </div>

                  <div className="cb-rec-job__body">
                    <h3 className="cb-rec-job__title">{job.title}</h3>
                    <p className="cb-rec-job__meta">
                      <span className="cb-rec-job__meta-icon" aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                          <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      </span>
                      {job.city || city || 'India'}
                    </p>
                    {experienceLabel ? (
                      <p className="cb-rec-job__meta">
                        <span className="cb-rec-job__meta-icon" aria-hidden>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M8 7V5.5A1.5 1.5 0 019.5 4h5A1.5 1.5 0 0116 5.5V7"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                            <rect
                              x="3.5"
                              y="7"
                              width="17"
                              height="12.5"
                              rx="2"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                            <path d="M3.5 12h17" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        </span>
                        Experience required: <strong>{experienceLabel}</strong>
                      </p>
                    ) : null}
                    {skills.length ? (
                      <div className="cb-rec-job__skills">
                        {skills.map((skill) => (
                          <span key={skill} className="cb-rec-job__skill">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="cb-rec-job__actions">
                    <button
                      type="button"
                      className="cb-rec-job__view"
                      onClick={() => router.push(`/jobs/${job.id}`)}
                    >
                      View
                    </button>
                    {job.applied ? (
                      <button type="button" className="cb-rec-job__apply is-applied" disabled>
                        Applied
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cb-rec-job__apply"
                        onClick={() => router.push(`/jobs/${job.id}/apply`)}
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
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
