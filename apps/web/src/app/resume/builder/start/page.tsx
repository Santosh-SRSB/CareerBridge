'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CandidateProfile } from '@careerbridge/shared';
import { getCandidateMe } from '@/lib/api';
import { api } from '@/features/resume-manual/manual-resume-api';
import { passportToFriendResumeData } from '@/lib/passport-to-friend-resume';
import { clearPendingResumeBuild, setPendingResumeBuild } from '@/lib/resume-build';
import { DRAFT_KEY, type PassportDraft } from '@/types/passport';
import '@/features/resume-manual/manual-editor.css';

function readPassportDraft(): PassportDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PassportDraft;
  } catch {
    return null;
  }
}

/** Fill gaps when passport was saved before about/interests/descriptions were persisted. */
function mergeDraftIntoProfile(profile: CandidateProfile, draft: PassportDraft | null): CandidateProfile {
  if (!draft) return profile;
  return {
    ...profile,
    firstName: profile.firstName || draft.firstName || profile.firstName,
    lastName: profile.lastName || draft.lastName || profile.lastName,
    city: profile.city || draft.city || profile.city,
    about: profile.about?.trim() ? profile.about : draft.about || profile.about,
    careerInterests:
      profile.careerInterests?.length > 0
        ? profile.careerInterests
        : (draft.careerInterests || []).filter(Boolean),
    skills:
      profile.skills?.length > 0
        ? profile.skills
        : (draft.skills || []).filter(Boolean).map((name, index) => ({ id: `draft-skill-${index}`, name })),
    education:
      profile.education?.length > 0
        ? profile.education
        : (draft.education || [])
            .filter((item) => item.qualification || item.institution)
            .map((item, index) => ({
              id: `draft-edu-${index}`,
              qualification: item.qualification,
              institution: item.institution || null,
              fieldOfStudy: item.fieldOfStudy || null,
              yearCompleted: Number.parseInt(item.yearCompleted, 10) || null,
              startDate: draft.educationStart || null,
              endDate: draft.stillInCollege ? null : draft.educationEnd || item.yearCompleted || null,
            })),
    experiences:
      profile.experiences?.length > 0
        ? profile.experiences.map((item, index) => {
            const fromDraft = draft.experience?.[index];
            if (item.description?.trim() || !fromDraft?.description?.trim()) return item;
            return { ...item, description: fromDraft.description };
          })
        : (draft.experience || [])
            .filter((item) => item.company || item.jobTitle || item.description)
            .map((item, index) => ({
              id: `draft-exp-${index}`,
              company: item.company,
              jobTitle: item.jobTitle,
              startDate: item.startDate || null,
              endDate: item.endDate || null,
              description: item.description || null,
              isInternship: Boolean(item.isInternship),
              stillInCompany: Boolean(item.stillInCompany),
            })),
    projects:
      profile.projects?.length > 0
        ? profile.projects
        : (draft.projects || [])
            .filter((item) => item.title?.trim())
            .map((item, index) => ({
              id: `draft-project-${index}`,
              title: item.title,
              role: item.role || null,
              year: item.year ? Number(item.year) || null : null,
              description: item.description || null,
              url: item.url || null,
            })),
    highestEducation: profile.highestEducation || draft.education?.[0]?.qualification || profile.highestEducation,
    educationStart: profile.educationStart || draft.educationStart || profile.educationStart,
    educationEnd: profile.educationEnd || draft.educationEnd || profile.educationEnd,
  };
}

function BuilderStartInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get('source') === 'manual' ? 'manual' : 'passport';
  const template = searchParams.get('template') || 'ats-minimal';
  const photo = searchParams.get('photo') === '1' ? '1' : '0';
  const includePhoto = photo === '1';
  const [error, setError] = useState('');

  useEffect(() => {
    setPendingResumeBuild({ template, photo, source });
    let cancelled = false;

    (async () => {
      try {
        let data: Record<string, unknown> = {
          fullName: '',
          title: '',
          email: '',
          phone: '',
          location: '',
          linkedin: '',
          website: '',
          photo: null,
          summary: '',
          experience: [],
          education: [],
          skills: [],
          projects: [],
          certifications: [],
          careerGaps: [],
          targetRole: '',
          jobDescription: '',
        };

        if (source === 'passport') {
          const profile = await getCandidateMe();
          const draft = readPassportDraft();
          data = passportToFriendResumeData(mergeDraftIntoProfile(profile, draft), { includePhoto });
        }

        const resume = await api.createResume({
          title: source === 'passport' ? 'Passport resume' : 'Untitled resume',
          templateId: template,
          includePhoto,
          data,
        });

        if (cancelled) return;
        clearPendingResumeBuild();
        router.replace(`/resume/builder/${resume.id}`);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not start the resume builder.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [includePhoto, photo, router, source, template]);

  return (
    <div className="cb-manual-resume-root">
      <div className="guidance-page">
        <p className="muted small">Resume builder</p>
        <h1>{source === 'passport' ? 'Loading from Career Passport…' : 'Opening blank editor…'}</h1>
        <p className="muted">
          {source === 'passport'
            ? 'We are filling your resume from your passport. You can edit any missing fields next.'
            : 'Creating a blank ATS resume with your selected template.'}
        </p>
        {error ? (
          <div className="alert" style={{ marginTop: 16 }}>
            <p>{error}</p>
            <button className="btn btn-primary" type="button" onClick={() => router.push('/dashboard')}>
              Back to dashboard
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ResumeBuilderStartPage() {
  return (
    <Suspense
      fallback={
        <div className="cb-manual-resume-root">
          <div className="guidance-page">
            <p className="muted">Starting resume builder…</p>
          </div>
        </div>
      }
    >
      <BuilderStartInner />
    </Suspense>
  );
}
