'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  photoFileError,
  resolveExperienceChip,
  resolveCandidateExperienceBand,
  formatLocationLabel,
  ONBOARDING_STEP_LABELS,
} from '@careerbridge/shared';
import type { ApplicationRecord, CandidateProfile, EmployabilityScore, JobCard } from '@careerbridge/shared';
import { ErrorState, Skeleton, SkeletonList } from '@/components/ui/StateViews';
import { isUnauthorizedError } from '@/lib/client-errors';
import { formatAnnualSalaryLpa } from '@/lib/match';
import {
  getCandidateMe,
  getEmployabilityScore,
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
import { browserReadablePhotoUrl } from '@/lib/photo-url';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { TestimonialPromptCard } from '@/components/TestimonialPromptCard';
import { formatCandidateExperienceLine, resolveTotalExperienceYears } from '@/lib/format-candidate-experience';
import { resolvePassportSummary } from '@/lib/passport-to-friend-resume';
import {
  fetchScheduledInterviews,
  isUpcomingInterview,
  sortInterviewsByTime,
  type ScheduledJobInterview,
} from '@/lib/candidate-marketplace-api';
import { mockInterviewSetupUrl } from '@/lib/mock-interview-url';
import { compressImageBlob } from '@/lib/image';
import './candidate-dashboard.css';

const PHOTO_ACCEPT = 'image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png';

/** Where a candidate completes an onboarding step they skipped. */
const SKIPPED_STEP_LINKS: Record<number, string> = {
  1: '/passport/personal',
  2: '/passport/experience',
  3: '/passport/preferences',
  4: '/passport/skills',
};

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
    const flag = (profile.hasExperience || '').toUpperCase();
    const internship =
      profile.experiences?.find((item) => item.isInternship && item.company?.trim()) ||
      profile.experiences?.find((item) => item.isInternship);
    if (flag === 'INTERNSHIP' || internship) {
      const company = internship?.company?.trim();
      return company ? `Internship · ${company}` : 'Internship';
    }
    return 'Fresher';
  }
  const total = resolveTotalExperienceYears(profile);
  if (total >= 1) {
    const rounded = Math.floor(total);
    return rounded <= 1 ? '1+ Year' : `${rounded}+ Years`;
  }
  return formatCandidateExperienceLine(profile) || 'Experienced';
}

function statusLabel(profile: CandidateProfile | null) {
  if (!profile) return 'CANDIDATE';
  return resolveExperienceChip(profile).label;
}

function companyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return (parts[0] || 'C').slice(0, 2).toUpperCase();
}

function jobSkillPills(job: JobCard, limit = 5) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of [...(job.requiredSkills || []), ...(job.preferredSkills || [])]) {
    const key = skill.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(skill.trim());
    if (out.length >= limit) break;
  }
  return out;
}

function PinGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function BriefcaseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function WalletGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 13h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
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
  const band = resolveCandidateExperienceBand(profile);
  const rows = profile.experiences;
  if (band === 'fresher') {
    const intern =
      rows.find((item) => item.isInternship && item.stillInCompany) ||
      rows.find((item) => item.isInternship && item.company?.trim()) ||
      rows.find((item) => item.isInternship) ||
      null;
    return intern?.company?.trim() || '—';
  }
  const paid = rows.filter((item) => !item.isInternship);
  const current =
    paid.find((item) => item.stillInCompany) ||
    paid.find((item) => !item.endDate) ||
    paid[0] ||
    rows.find((item) => item.stillInCompany) ||
    rows[0];
  return current?.company?.trim() || '—';
}

function formatInterviewDate(value: string) {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function interviewStatusLabel(status: ScheduledJobInterview['status']) {
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'RESCHEDULE_NEEDED') return 'Choose another time';
  if (status === 'RESCHEDULE_REQUESTED') return 'Waiting for employer to schedule';
  return 'Pending confirmation';
}

function formatInterviewTime(interview: ScheduledJobInterview) {
  if (interview.scheduledAt) {
    const at = new Date(interview.scheduledAt);
    if (!Number.isNaN(at.getTime())) {
      return at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  }
  return interview.scheduledTime || '';
}

function interviewTypeLabel(mode: ScheduledJobInterview['mode']) {
  return mode === 'VIDEO' ? 'Video interview' : 'In-person interview';
}

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  SELECTED: 'Selected',
  REJECTED: 'Not selected',
  WITHDRAWN: 'Withdrawn',
  HIRED: 'Hired',
};

function ProfileCompletedRing({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, Math.round(value)));
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="cd-ring" title={`${safe}% profile completed`}>
      <div className="cd-ring-visual">
        <svg className="cd-ring-svg" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={radius} className="cd-ring-track" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="cd-ring-fill"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="cd-ring-num">{safe}%</span>
      </div>
      <span className="cd-ring-lbl">Profile Completed</span>
    </div>
  );
}

function PlaneGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 4 3 11l7 3 3 7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
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
  const band = resolveCandidateExperienceBand(profile);
  if (band === 'fresher') return 'fresher';
  const total = resolveTotalExperienceYears(profile);
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
  const [employability, setEmployability] = useState<EmployabilityScore | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [bio, setBio] = useState('');
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledJobInterview[]>([]);
  const [applicationCount, setApplicationCount] = useState(0);
  const [recentApplications, setRecentApplications] = useState<ApplicationRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPct, setPhotoPct] = useState(0);
  const [photoError, setPhotoError] = useState('');
  const [photoBroken, setPhotoBroken] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

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

    setDataState('loading');
    let meLoaded = false;
    fetchMe()
      .then((me) => {
        meLoaded = true;
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
          fetchScheduledInterviews(),
          listApplications(),
          listResumes()
            .then((items) => {
              const latest = [...items].sort(
                (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
              )[0];
              return latest?.summary || latest?.content?.summary || '';
            })
            .catch(() => ''),
        ]).then(([, candidateProfile, completion, jobItems, interviews, applications, resumeSummary]) => {
          setProfile(candidateProfile);
          if (candidateProfile.photoUrl) {
            patchStoredUser({ photoUrl: candidateProfile.photoUrl });
          }
          setName(formatPersonName(candidateProfile.firstName || me.firstName || stored.firstName || 'there'));
          setCity(
            formatLocationLabel(
              candidateProfile.city,
              candidateProfile.state,
              candidateProfile.preferredWorkCity,
            ) || candidateProfile.city || candidateProfile.preferredWorkCity || '',
          );
          const percent = completion?.percentage ?? candidateProfile.profileCompletion ?? 0;
          setCompletionPercent(percent);
          setBio(resolvePassportSummary(candidateProfile, resumeSummary || undefined));
          setJobs(jobItems.slice(0, 3));
          const upcoming = sortInterviewsByTime(
            interviews.filter(
              (item) =>
                item.status !== 'RESCHEDULE_REQUESTED' &&
                item.status !== 'RESCHEDULE_NEEDED' &&
                isUpcomingInterview(item),
            ),
          );
          setScheduledInterviews(upcoming);
          setApplicationCount(applications.length);
          setRecentApplications(
            [...applications]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 3),
          );
          setDataState('ready');
        });
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) return;
        if (!meLoaded && !stored.onboardingCompleted) {
          router.replace('/onboarding/continue');
          return;
        }
        setName(formatPersonName(stored.firstName || 'there'));
        setReady(true);
        setDataState('error');
      });
  }, [router, reloadKey]);

  useEffect(() => {
    if (dataState !== 'ready') return;
    getEmployabilityScore()
      .then(setEmployability)
      .catch(() => setEmployability(null));
  }, [dataState, reloadKey]);

  useEffect(() => {
    const onPhoto = (event: Event) => {
      const detail = (event as CustomEvent<{ photoUrl?: string | null }>).detail;
      if (!detail || !('photoUrl' in detail)) return;
      const url = detail.photoUrl ?? null;
      setProfile((prev) => (prev ? { ...prev, photoUrl: url } : prev));
      patchStoredUser({ photoUrl: url });
      setPhotoBroken(false);
      setPhotoPreviewUrl(null);
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

  const displayPhotoUrl = photoPreviewUrl || browserReadablePhotoUrl(profile?.photoUrl);
  // Keep preview visible during upload — hiding it caused a flash of the blue circle.
  const showPhoto = Boolean(displayPhotoUrl) && !photoBroken;

  async function onPickDashboardPhoto(file?: File) {
    if (!file || photoUploading) return;
    const invalid = photoFileError(file.type, file.size);
    if (invalid) {
      setPhotoError(invalid);
      return;
    }
    setPhotoError('');
    setPhotoBroken(false);
    setPhotoUploading(true);
    setPhotoPct(10);
    let localPreview: string | null = null;
    try {
      const blob = await compressImageBlob(file, 420);
      localPreview = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not preview that photo.'));
        reader.readAsDataURL(blob);
      });
      setPhotoPreviewUrl(localPreview);
      setPhotoPct(55);
      const updated = await uploadCandidatePhoto(blob, 'photo.jpg');
      const nextUrl = updated.photoUrl;
      if (!nextUrl) throw new Error('Photo was not saved. Please try again.');
      setProfile((prev) => (prev ? { ...prev, photoUrl: nextUrl } : prev));
      notifyPhotoUpdated(nextUrl);
      setPhotoPct(100);
      await new Promise((r) => setTimeout(r, 280));
      // Prefer server-readable URL (signed / data). Keep local preview only as backup.
      if (nextUrl.startsWith('data:') || nextUrl.includes('X-Goog-Signature') || nextUrl.includes('Signature=')) {
        setPhotoPreviewUrl(null);
      }
      setPhotoBroken(false);
    } catch (err) {
      // Keep local preview if upload failed after we already showed it.
      if (!localPreview) setPhotoPreviewUrl(null);
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
        <div className="space-y-4 p-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-48 w-full" />
          <SkeletonList rows={3} label="Loading dashboard…" />
        </div>
      </CandidateAppShell>
    );
  }

  if (dataState === 'error') {
    return (
      <CandidateAppShell activeTab="home" maxWidth="max-w-[1180px]">
        <div className="p-4">
          <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
        </div>
      </CandidateAppShell>
    );
  }

  const widgetsLoading = dataState === 'loading';

  return (
    <CandidateAppShell activeTab="home" maxWidth="max-w-[1180px]" avatarUrl={profile?.photoUrl}>
      <div className="cd">
        <div className="cd-greet">
          <p className="cd-crumb">Boarding · Career Journey</p>
          <h1 className="cd-hello">Hello, {name}</h1>
          <p className="cd-sub">
            {isProfileComplete
              ? 'Welcome back. Your check-in is complete — explore stronger job matches below.'
              : 'Welcome back. Finish check-in on your profile to board better job matches.'}
          </p>
        </div>

        <TestimonialPromptCard audience="CANDIDATE" />

        <section className="cd-passport" aria-label="Career passport">
          <div className="cd-pp-left">
            <div className="cd-pp-top">
              <div className="cd-pp-status">
                <div className="cd-big">{statusLabel(profile)}</div>
                <div className="cd-lbl">Status</div>
              </div>
              <p className="cd-pp-mid" aria-hidden>
                Career Passport <PlaneGlyph />
              </p>
              <div className="cd-pp-right-t">
                <div className="cd-big">{targetRole(profile)}</div>
                <div className="cd-lbl">Target Role</div>
              </div>
            </div>

            <div className="cd-level">
              <div className="cd-lbl cd-lbl--flush">Level</div>
              <div className="cd-pills">
                {EXPERIENCE_LEVEL_CHIPS.map((chip) => (
                  <span key={chip.key} className={`cd-pill${experienceChip === chip.key ? ' is-active' : ''}`}>
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="cd-info">
              <div>
                <div className="cd-lbl cd-lbl--flush">Passenger</div>
                <div className="cd-info-val">{fullName}</div>
              </div>
              <div>
                <div className="cd-lbl cd-lbl--flush">Experienced</div>
                <div className="cd-info-val">{formatExperienceField(profile)}</div>
              </div>
              <div className="cd-info-company">
                <div className="cd-lbl cd-lbl--flush">Company</div>
                <div className="cd-info-val">{currentCompany(profile)}</div>
              </div>
            </div>

            <div className="cd-prog">
              <div className="cd-prog-h">
                <span>Check-in progress</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="cd-bar">
                <span style={{ width: `${Math.min(100, Math.max(0, completionPercent))}%` }} />
              </div>
            </div>

            {profile?.onboardingSkippedSteps?.length ? (
              <div role="note" data-testid="skipped-sections" className="cd-skipped">
                <p>Skipped during setup:</p>
                <ul>
                  {profile.onboardingSkippedSteps.map((step) => (
                    <li key={step}>
                      <Link href={SKIPPED_STEP_LINKS[step] ?? '/profile'}>
                        {ONBOARDING_STEP_LABELS[step] ?? `Step ${step}`}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!isProfileComplete ? (
              <button type="button" className="cd-btn cd-btn--dark" onClick={() => router.push('/profile')}>
                Complete Profile
              </button>
            ) : (
              <button type="button" className="cd-btn cd-btn--dark" onClick={() => router.push('/jobs')}>
                Browse Jobs
              </button>
            )}
          </div>

          <aside className="cd-pp-right">
            <div className="cd-pr-head">
              <span>Career Passport</span>
              <b>FREE</b>
            </div>
            <div className="cd-pr-main">
              <div className="cd-photo-wrap">
                <button
                  type="button"
                  className="cd-photo"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  aria-label={showPhoto ? 'Change profile photo' : 'Add profile photo'}
                >
                  {showPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={displayPhotoUrl || 'photo'}
                      src={
                        !displayPhotoUrl
                          ? ''
                          : displayPhotoUrl.startsWith('data:') || displayPhotoUrl.startsWith('blob:')
                            ? displayPhotoUrl
                            : `${displayPhotoUrl}${displayPhotoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(displayPhotoUrl.slice(-24))}`
                      }
                      alt=""
                      onLoad={() => {
                        setPhotoBroken(false);
                        // Remote readable URL loaded — drop local preview.
                        if (
                          photoPreviewUrl &&
                          profile?.photoUrl &&
                          displayPhotoUrl === profile.photoUrl
                        ) {
                          setPhotoPreviewUrl(null);
                        }
                      }}
                      onError={() => {
                        // Private GCS URL often 403s. Keep local preview if we have one.
                        if (photoPreviewUrl && displayPhotoUrl !== photoPreviewUrl) {
                          return;
                        }
                        if (photoPreviewUrl) return;
                        setPhotoBroken(true);
                      }}
                    />
                  ) : (
                    <span className="cd-photo-empty">
                      <span aria-hidden>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M4 8.5A2.5 2.5 0 016.5 6h2.1l1.2-1.8A1.5 1.5 0 0111 3.5h2a1.5 1.5 0 011.2.7L15.4 6h2.1A2.5 2.5 0 0120 8.5v9A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5v-9z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                          <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      </span>
                      <span className="cd-photo-stripe">Add Photo</span>
                    </span>
                  )}
                  {photoUploading ? (
                    <span className="cd-photo-upload" aria-live="polite">
                      <span className="cd-photo-water" style={{ height: `${Math.max(12, photoPct)}%` }} />
                      <span className="cd-photo-upload-txt">
                        {photoPct < 100 ? `${photoPct}%` : '✓'}
                      </span>
                    </span>
                  ) : null}
                </button>
                {showPhoto ? (
                  <button
                    type="button"
                    className="cd-photo-edit"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    aria-label="Edit profile photo"
                    title="Edit photo"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <path d="M12.5 7.5l4 4" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </button>
                ) : null}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept={PHOTO_ACCEPT}
                aria-label="Upload profile photo"
                className="sr-only"
                tabIndex={-1}
                disabled={photoUploading}
                onChange={(event) => void onPickDashboardPhoto(event.target.files?.[0])}
              />
              <div className="cd-who">
                <div className="cd-who-name">{fullName}</div>
                <div className="cd-who-loc">{city || 'India'}</div>
                {photoError ? <div className="cd-photo-err">{photoError}</div> : null}
              </div>
              <ProfileCompletedRing value={completionPercent} />
            </div>

            <div className="cd-sum">
              <div className="cd-sum-lbl">Summary</div>
              <p>{bio || 'Complete your profile to unlock a stronger career summary.'}</p>
            </div>

            <button type="button" className="cd-btn cd-btn--orange" onClick={() => router.push('/profile/details')}>
              View Profile
            </button>
            {employability ? (
              <Link href="/passport#employability" className="cd-employability" data-testid="dashboard-employability">
                Employability score: {employability.score}/100 ({employability.band})
              </Link>
            ) : null}
          </aside>
        </section>

        <section className="cd-stats" aria-label="Profile stats">
          <div className="cd-stat">
            <div className="cd-stat-num">{completionPercent}%</div>
            <div className="cd-stat-lbl">Strength</div>
          </div>
          <div className="cd-stat">
            <div className="cd-stat-num">{skillsCount}</div>
            <div className="cd-stat-lbl">Skills</div>
          </div>
          <div className="cd-stat">
            <div className="cd-stat-num">{scheduledInterviews.length}</div>
            <div className="cd-stat-lbl">Interviews</div>
          </div>
          <div className="cd-stat">
            <div className="cd-stat-num">{applicationCount}</div>
            <div className="cd-stat-lbl">Applications</div>
          </div>
        </section>

        <div className="cd-sec-h">
          <h2>Recommended Jobs</h2>
          <button type="button" onClick={() => router.push('/jobs')}>
            View all jobs →
          </button>
        </div>

        {widgetsLoading ? (
          <SkeletonList rows={3} label="Loading recommended jobs…" />
        ) : jobs.length === 0 ? (
          <div className="cd-empty">
            <p>
              Currently no match found with your profile. We will notify you when a suitable role
              opens up.
            </p>
            <button type="button" className="cd-btn cd-btn--dark" onClick={() => router.push('/jobs')}>
              Browse all jobs
            </button>
          </div>
        ) : (
          <div className="cd-jobs">
            {jobs.map((job) => {
              const skills = jobSkillPills(job);
              const matchScore =
                typeof job.match?.score === 'number' ? Math.round(job.match.score) : null;
              const experienceLabel = job.experience?.trim() || null;
              const salaryLabel = formatAnnualSalaryLpa(job.salaryMin, job.salaryMax);
              return (
                <article key={job.id} className="cd-job">
                  <div className="cd-job-top">
                    <span className="cd-job-logo" aria-hidden>
                      {companyInitials(job.companyName)}
                    </span>
                    <span className="cd-job-co">{job.companyName}</span>
                    <span className="cd-job-match">
                      {matchScore != null ? `${matchScore}% match` : 'Recommended'}
                    </span>
                  </div>

                  <div className="cd-job-body">
                    <h3 className="cd-job-title">{job.title}</h3>
                    <p className="cd-meta">
                      <PinGlyph />
                      {formatLocationLabel(job.city, (job as { state?: string | null }).state) ||
                        job.city ||
                        city ||
                        'India'}
                    </p>
                    <p className="cd-meta" data-testid="rec-job-salary">
                      <WalletGlyph />
                      {salaryLabel || 'Salary not disclosed'}
                    </p>
                    {experienceLabel ? (
                      <p className="cd-meta">
                        <BriefcaseGlyph />
                        <span>
                          Experience required: <strong>{experienceLabel}</strong>
                        </span>
                      </p>
                    ) : null}
                    {skills.length > 0 ? (
                      <div className="cd-tags">
                        {skills.map((skill) => (
                          <span key={skill} className="cd-tag">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="cd-job-act">
                      <button
                        type="button"
                        className="cd-btn cd-btn--mint"
                        onClick={() => router.push(`/jobs/${job.id}`)}
                      >
                        View
                      </button>
                      {job.applied ? (
                        <button type="button" className="cd-btn cd-btn--applied" disabled>
                          Applied
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cd-btn cd-btn--dark"
                          onClick={() => router.push(`/jobs/${job.id}/apply`)}
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="cd-sec-h">
          <h2>Scheduled Interviews</h2>
          <button type="button" onClick={() => router.push('/interviews')}>
            View all interviews →
          </button>
        </div>

        {widgetsLoading ? (
          <SkeletonList rows={2} label="Loading interviews…" />
        ) : displayInterviews.length === 0 ? (
          <div className="cd-empty">
            <p>No interviews scheduled yet. Practice a mock interview while you wait.</p>
            <div className="cd-empty-row">
              <button type="button" className="cd-btn cd-btn--mint" onClick={() => router.push('/applications')}>
                Track applications
              </button>
              <button type="button" className="cd-btn cd-btn--dark" onClick={() => router.push('/interviews/mock')}>
                Practice mock interview
              </button>
            </div>
          </div>
        ) : (
          <div className="cd-items">
            {displayInterviews.map((interview) => (
              <article key={interview.id} className="cd-item">
                <h3>{interview.jobTitle}</h3>
                <div className="cd-item-co">{interview.companyName}</div>
                <div className="cd-item-when">
                  {formatInterviewDate(interview.scheduledDate)}
                  {formatInterviewTime(interview) ? ` · ${formatInterviewTime(interview)}` : ''}
                </div>
                <div className="cd-item-co">
                  {[
                    interviewTypeLabel(interview.mode),
                    interview.durationMin ? `${interview.durationMin} min` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="cd-item-status">{interviewStatusLabel(interview.status).toUpperCase()}</div>
                <div className="cd-item-act">
                  <button
                    type="button"
                    className="cd-btn cd-btn--mint"
                    onClick={() => router.push(`/interviews/scheduled/${interview.id}`)}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="cd-btn cd-btn--dark"
                    onClick={() => router.push(mockInterviewSetupUrl(interview.jobTitle))}
                  >
                    Prepare
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="cd-sec-h">
          <h2>Application Status</h2>
          <button type="button" onClick={() => router.push('/applications')}>
            View all applications →
          </button>
        </div>

        {widgetsLoading ? (
          <SkeletonList rows={2} label="Loading applications…" />
        ) : recentApplications.length === 0 ? (
          <div className="cd-empty" data-state="empty">
            <p>You haven&apos;t applied for any jobs yet.</p>
            <button type="button" className="cd-btn cd-btn--dark" onClick={() => router.push('/jobs')}>
              Find Jobs
            </button>
          </div>
        ) : (
          <div className="cd-items" data-testid="dashboard-applications">
            {recentApplications.map((application) => (
              <article key={application.id} className="cd-item">
                <h3>{application.job.title}</h3>
                <div className="cd-item-co">{application.job.companyName}</div>
                <div className="cd-item-when">Applied {formatInterviewDate(application.createdAt)}</div>
                <div className="cd-item-status">
                  {(APPLICATION_STATUS_LABELS[application.status] || application.status).toUpperCase()}
                </div>
                <div className="cd-item-act">
                  <button
                    type="button"
                    className="cd-btn cd-btn--mint"
                    onClick={() => router.push(`/applications/${application.id}`)}
                  >
                    View
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
