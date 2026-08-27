'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CandidateLinks, CandidateProfile, PassportSection, ProfileCompletion } from '@careerbridge/shared';
import { formatLanguageSkill, parseLanguageSkills } from '@careerbridge/shared';
import { getCandidateMe, getProfileCompletion } from '@/lib/api';
import { clearPendingResumeBuild } from '@/lib/resume-build';
import { getStoredUser } from '@/lib/session';
import { PASSPORT_FLOW_START, PASSPORT_OVERVIEW } from '@/lib/passport-flow';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';

const LINK_LABELS: Array<{ key: keyof CandidateLinks; label: string }> = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'github', label: 'GitHub' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'website', label: 'Website' },
];

function prettyText(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sectionDetails(profile: CandidateProfile, section: PassportSection): string[] {
  const name = prettyText([profile.firstName, profile.lastName].filter(Boolean).join(' '));
  const city = prettyText(profile.city || '');

  if (section.key === 'personal') {
    return [
      name || 'Name not added',
      city ? `Lives in ${city}` : '',
      profile.dateOfBirth ? `Born ${formatDate(profile.dateOfBirth)}` : '',
      profile.gender ? prettyText(profile.gender.toLowerCase()) : '',
      profile.phone || '',
      profile.email || '',
    ].filter(Boolean);
  }

  if (section.key === 'photo') {
    return profile.photoUrl ? ['Photo added'] : [];
  }

  if (section.key === 'education') {
    return profile.education.map((item) =>
      [item.qualification, item.institution, item.fieldOfStudy, item.yearCompleted ? String(item.yearCompleted) : '']
        .filter(Boolean)
        .join(' · '),
    );
  }

  if (section.key === 'skills') {
    return profile.skills.length ? profile.skills.map((item) => prettyText(item.name)) : [];
  }

  if (section.key === 'experience') {
    if (profile.hasExperience === 'NONE') return ['No work experience yet'];
    return profile.experiences.map((item) =>
      [prettyText(item.jobTitle), prettyText(item.company)].filter(Boolean).join(' · '),
    );
  }

  if (section.key === 'preferences') {
    const interests = profile.careerInterests.map((item) => prettyText(item));
    if (profile.openToRelocating) interests.push('Open to relocating');
    return interests;
  }

  if (section.key === 'languages') {
    return parseLanguageSkills(profile.preferredLanguage).map((item) => formatLanguageSkill(item));
  }

  if (section.key === 'certifications') {
    return (profile.certifications || []).map((item) =>
      [prettyText(item.name), item.issuer, item.year ? String(item.year) : '', item.credentialId]
        .filter(Boolean)
        .join(' · '),
    );
  }

  if (section.key === 'projects') {
    return (profile.projects || []).map((item) =>
      [prettyText(item.title), item.role, item.year ? String(item.year) : '', item.url].filter(Boolean).join(' · '),
    );
  }

  if (section.key === 'links') {
    return LINK_LABELS.filter((item) => profile.links?.[item.key]).map((item) => item.label);
  }

  return [];
}

export function PassportOverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showOverview = searchParams.get('overview') === '1';
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    if (!showOverview) {
      router.replace(PASSPORT_FLOW_START);
      return;
    }
    // Never bounce back into ATS build / download from passport overview.
    clearPendingResumeBuild();
    Promise.all([getCandidateMe(), getProfileCompletion()])
      .then(([nextProfile, nextCompletion]) => {
        setProfile(nextProfile);
        setCompletion(nextCompletion);
      })
      .catch(() => router.replace('/login'));
  }, [router, showOverview]);

  if (!showOverview) {
    return <main className="cb-app text-muted">Opening Personal information...</main>;
  }

  if (!profile || !completion) {
    return <main className="cb-app text-muted">Loading your Career Passport...</main>;
  }

  const name = prettyText([profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Your name');
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const doneCount = completion.sections.filter((item) => item.done).length;
  const activeLinks = LINK_LABELS.filter((item) => profile.links?.[item.key]);
  const bodySections = completion.sections.filter((item) => item.key !== 'photo' && item.key !== 'links');

  return (
    <main className="cb-profile-page">
      <BackButton href="/dashboard" fallback="/dashboard" className="cb-wizard-home" />

      <article className="cb-profile-sheet">
        <header className="cb-profile-hero">
          <Link href="/passport/photo?flow=1" className="cb-profile-photo-lg" aria-label="Edit photo">
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoUrl} alt={name} />
            ) : (
              <span>{initials || 'P'}</span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal">Career Passport</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{name}</h1>
            <p className="mt-1 text-sm text-muted">
              {[prettyText(profile.city || ''), profile.phone, profile.email].filter(Boolean).join(' · ')}
            </p>
            <div className="cb-profile-meter" aria-label={`${completion.percentage}% ready`}>
              <span style={{ width: `${completion.percentage}%` }} />
            </div>
            <p className="mt-2 text-sm font-semibold text-primary">
              {completion.percentage}% ready · {doneCount} of {completion.sections.length} sections
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeLinks.length ? (
                activeLinks.map((item) => (
                  <a
                    key={item.key}
                    href={profile.links[item.key]}
                    target="_blank"
                    rel="noreferrer"
                    className="cb-profile-chip"
                  >
                    {item.label}
                  </a>
                ))
              ) : (
                <Link href="/passport/links?flow=1" className="cb-profile-chip is-empty">
                  Add LinkedIn / GitHub / portfolio
                </Link>
              )}
            </div>
          </div>
        </header>

        {bodySections.map((item) => {
          const details = item.done ? sectionDetails(profile, item) : [];
          return (
            <section key={item.key} className="cb-profile-block">
              <div className="cb-profile-block-head">
                <h2>{item.label}</h2>
                <Link href={`${item.href}?flow=1`}>{item.done ? 'Edit' : 'Add'}</Link>
              </div>
              {details.length ? (
                <ul className="mt-3 space-y-1">
                  {details.map((value) => (
                    <li key={value} className="text-sm leading-6 text-primary">
                      {value}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted">{item.why}</p>
              )}
            </section>
          );
        })}

        <footer className="cb-profile-footer">
          <div>
            <p className="text-sm font-semibold text-primary">Finish and save resume</p>
            <p className="mt-1 text-sm text-muted">
              We will save your current details and take you to the dashboard. ATS download lives under Build / Enhance Resume.
            </p>
          </div>
          <Button type="button" size="md" block={false} onClick={() => router.replace(PASSPORT_OVERVIEW)}>
            Save resume &amp; continue
          </Button>
        </footer>
      </article>
    </main>
  );
}

export default function PassportPage() {
  return (
    <Suspense fallback={<main className="cb-app text-muted">Loading your Career Passport...</main>}>
      <PassportOverviewPage />
    </Suspense>
  );
}
