'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { CandidateProfile, ResumeRecord } from '@careerbridge/shared';
import { getTemplateComponent } from '@/components/resume-templates/index.js';
import { buildResumeFromProfile } from '@/features/resume/build-resume-from-profile';
import { buildResumeFromResumeContent } from '@/features/resume/build-resume-from-resume-content';
import { masterResumeToAtsData } from '@/features/resume/master-to-ats-data';
import type { MasterResumeDocument } from '@/features/resume/master-resume.types';
import { downloadMasterResumePdf } from '@/lib/master-resume-pdf';
import { listResumes } from '@/lib/api';
import { startResumeUpdate } from '@/features/resume/resume-update-mode';
import { Button } from '@/components/ui/Button';
import '@/components/resume-templates/resume-template-01.css';

const PREVIEW_TEMPLATE = 'resume-template-01';

function pickLatestResume(items: ResumeRecord[]) {
  if (!items.length) return null;
  return [...items].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )[0];
}

export function DashboardResumePreviewModal({
  profile,
  onClose,
}: {
  profile: CandidateProfile;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [savedResume, setSavedResume] = useState<ResumeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const profileResume = useMemo(() => buildResumeFromProfile(profile), [profile]);
  const resumeDoc = useMemo<MasterResumeDocument>(() => {
    if (savedResume?.content) {
      const content = savedResume.content;
      return buildResumeFromResumeContent(
        {
          ...content,
          fullName: content.fullName || profile.firstName || '',
          city: content.city || profile.city || profile.preferredWorkCity || null,
          email: content.email || null,
          phone: content.phone || profile.phone || null,
          summary: content.summary || savedResume.summary || profile.about || '',
        },
        content.summary || savedResume.summary,
      );
    }
    return profileResume;
  }, [savedResume, profileResume, profile]);
  const templateData = useMemo(() => masterResumeToAtsData(resumeDoc), [resumeDoc]);
  const Template = getTemplateComponent(PREVIEW_TEMPLATE);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    listResumes()
      .then((items) => {
        if (!active) return;
        setSavedResume(pickLatestResume(items));
      })
      .catch(() => {
        if (!active) return;
        setSavedResume(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const fileName = `${resumeDoc.personalInfo.fullName.replace(/\s+/g, '-') || 'My'}-Resume.pdf`;
      await downloadMasterResumePdf(resumeDoc, fileName);
    } catch {
      setDownloadError('Could not download your resume. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  function handleUpdate() {
    startResumeUpdate(savedResume?.id);
    onClose();
    router.push('/resume');
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col p-3 sm:p-5" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
        aria-label="Close preview"
        onClick={onClose}
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-4xl min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-end border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close resume preview"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 [-webkit-overflow-scrolling:touch]">
            <div className="p-3 sm:p-6">
              {loading ? (
                <div className="mx-auto max-w-[794px] rounded-xl bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                  Loading resume preview...
                </div>
              ) : (
                <div className="cb-dashboard-resume-preview mx-auto w-full max-w-[794px] overflow-hidden bg-white shadow-md ring-1 ring-slate-200">
                  <Template data={templateData} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-3 shrink-0 space-y-2 pb-[env(safe-area-inset-bottom)]">
          {downloadError ? (
            <p className="text-center text-sm font-medium text-red-600">{downloadError}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleUpdate}
              disabled={loading}
              className="rounded-xl text-sm font-bold"
            >
              Update
            </Button>
            <Button
              type="button"
              onClick={handleDownload}
              disabled={downloading || loading}
              className="rounded-xl text-sm font-bold"
            >
              {downloading ? 'Preparing...' : 'Download'}
            </Button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .cb-dashboard-resume-preview .resume,
        .cb-dashboard-resume-preview .resume-template-01 {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
        }
      `}</style>
    </div>,
    document.body,
  );
}
