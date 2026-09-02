'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CandidateProfile, ProfileCompletion } from '@careerbridge/shared';
import { createResume, getCandidateMe, getProfileCompletion } from '@/lib/api';
import { AtsResumeSheet } from '@/components/AtsResumeSheet';
import { downloadResumePdfFile } from '@/lib/resume-pdf';
import {
  clearPendingResumeBuild,
  profileToResumeContent,
  setPendingResumeBuild,
} from '@/lib/resume-build';
import { PASSPORT_FLOW_START } from '@/lib/passport-flow';

const STEPS = [
  'Your resume is about to complete',
  'Contact details added',
  'About section completed',
  'Experience section completed',
  'Education section completed',
  'Skills section completed',
];

function firstMissingHref(completion: ProfileCompletion) {
  const missing = completion.sections.find((item) => !item.done && item.weight > 0);
  return missing ? `${missing.href}?flow=1` : PASSPORT_FLOW_START;
}

function ResumeBuildInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const template = searchParams.get('template') || 'CLASSIC';
  const photo = searchParams.get('photo') === '1' ? '1' : '0';
  const withPhoto = photo === '1';

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [stage, setStage] = useState(0);
  const [phase, setPhase] = useState<'fill' | 'ready' | 'missing'>('fill');
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setPendingResumeBuild({ template, photo, source: 'passport' });
    Promise.all([getCandidateMe(), getProfileCompletion()])
      .then(([nextProfile, nextCompletion]) => {
        setProfile(nextProfile);
        setCompletion(nextCompletion);
      })
      .catch(() => router.replace('/login'));
  }, [photo, router, template]);

  useEffect(() => {
    if (!profile || !completion || phase !== 'fill') return;
    if (stage >= STEPS.length) {
      if (completion.percentage >= 100) {
        createResume({
          template,
          targetJobTitle: profile.careerInterests[0] || undefined,
          includePhoto: withPhoto,
        })
          .then((resume) => {
            setResumeId(resume.id);
            setPhase('ready');
            clearPendingResumeBuild();
          })
          .catch(() => setPhase('ready'));
      } else {
        setPhase('missing');
      }
      return;
    }
    const timer = window.setTimeout(() => setStage((value) => value + 1), stage === 0 ? 900 : 1100);
    return () => window.clearTimeout(timer);
  }, [completion, phase, profile, stage, template, withPhoto]);

  const content = useMemo(() => (profile ? profileToResumeContent(profile) : null), [profile]);

  async function onDownload() {
    if (!content) return;
    flushSync(() => setDownloading(true));
    try {
      if (!resumeId) {
        const resume = await createResume({
          template,
          targetJobTitle: profile?.careerInterests[0] || undefined,
          includePhoto: withPhoto,
        });
        setResumeId(resume.id);
      }
      await downloadResumePdfFile({
        content,
        template,
        photoUrl: withPhoto ? profile?.photoUrl : null,
        fileName: `${(content.fullName || 'resume').replace(/\s+/g, '-')}.pdf`,
      });
    } finally {
      setDownloading(false);
    }
  }

  if (!profile || !completion || !content) {
    return <main className="cb-build-page">Preparing your resume...</main>;
  }

  const complete = completion.percentage >= 100;
  const status =
    phase === 'fill'
      ? STEPS[Math.min(stage, STEPS.length - 1)]
      : complete
        ? 'Your resume is ready'
        : 'Lots of data are missing';

  return (
    <main className="cb-build-page">
      <p className="cb-build-status" aria-live="polite">
        {status}
      </p>
      <AtsResumeSheet
        content={content}
        template={template}
        photoUrl={profile.photoUrl}
        withPhoto={withPhoto}
        targetJobTitle={profile.careerInterests[0]}
      />

      {phase === 'ready' ? (
        <button type="button" className="resume-download-btn" onClick={onDownload} disabled={downloading}>
          {downloading ? 'Loading...' : 'Download PDF'}
        </button>
      ) : null}

      {phase === 'missing' ? (
        <div className="cb-build-missing">
          <p>
            Lots of data are missing from your Career Passport
            {completion.missing.length ? `: ${completion.missing.join(', ')}` : '.'}
          </p>
          <button
            type="button"
            className="cb-build-passport-btn"
            onClick={() => {
              setPendingResumeBuild({ template, photo, source: 'passport' });
              router.push(firstMissingHref(completion));
            }}
          >
            Complete passport
          </button>
        </div>
      ) : null}
    </main>
  );
}

export default function ResumeBuildPage() {
  return (
    <Suspense fallback={<main className="cb-build-page">Preparing your resume...</main>}>
      <ResumeBuildInner />
    </Suspense>
  );
}
