'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ResumeRecord } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { ResumeAtsTopSwitcher } from '@/components/ResumeAtsTopSwitcher';
import { ResumePreviewScreen } from '@/components/resume/ResumePreviewScreen';
import { buildResumeFromResumeContent } from '@/features/resume/build-resume-from-resume-content';
import type { MasterResumeDocument } from '@/features/resume/master-resume.types';
import type { ResumeAiSuggestion } from '@/features/resume/resume-ai-review';
import { createResume, getResume, listResumes, updateResume } from '@/lib/api';
import { masterResumeToResumeContent } from '@/features/resume/master-to-resume-content';

function AtsCheckerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeIdQuery = searchParams.get('resumeId');

  const [items, setItems] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(resumeIdQuery);
  const [master, setMaster] = useState<MasterResumeDocument | null>(null);
  const [resumeMeta, setResumeMeta] = useState<ResumeRecord | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listResumes();
      setItems(rows);
      if (resumeIdQuery && rows.some((r) => r.id === resumeIdQuery)) {
        setSelectedId(resumeIdQuery);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load resumes.');
    } finally {
      setLoading(false);
    }
  }, [resumeIdQuery]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openAts(id: string) {
    setChecking(true);
    setError('');
    try {
      const record = await getResume(id);
      const doc = buildResumeFromResumeContent(
        {
          ...record.content,
          fullName: record.content.fullName || '',
          summary: record.content.summary || record.summary || '',
        },
        record.summary,
      );
      setMaster(doc);
      setResumeMeta(record);
      setSelectedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open resume for ATS.');
      setMaster(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (resumeIdQuery && !master && !checking) {
      void openAts(resumeIdQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeIdQuery]);

  const selectedLabel = useMemo(() => {
    const row = items.find((r) => r.id === selectedId) || resumeMeta;
    return row ? `${row.title} (V${row.version})` : '';
  }, [items, selectedId, resumeMeta]);

  function applySuggestion(suggestion: ResumeAiSuggestion, improvedText: string) {
    if (!master) return;
    setMaster((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const lines = improvedText
        .split(/\n+/)
        .map((line) => line.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
      switch (suggestion.section) {
        case 'summary':
          next.summary = improvedText.replace(/\n+/g, ' ').trim();
          break;
        case 'skills': {
          const skills = improvedText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          next.technicalSkills = [{ category: 'Skills', skills }];
          break;
        }
        case 'experience':
          if (next.experience[0]) {
            next.experience[0] = { ...next.experience[0], responsibilities: lines };
          }
          break;
        case 'education':
          break;
        case 'projects':
          if (next.projects[0]) {
            next.projects[0] = {
              ...next.projects[0],
              description: lines[0] || improvedText,
              bullets: lines.length > 1 ? lines.slice(1) : lines,
            };
          }
          break;
        default:
          break;
      }
      return next;
    });
  }

  async function ensureSaved(): Promise<string> {
    if (!master) throw new Error('No resume loaded.');
    const content = masterResumeToResumeContent(master);
    if (selectedId) {
      // Keep working copy updated; final Save in ATS flow creates a new version.
      await updateResume(selectedId, {
        title: resumeMeta?.title,
        targetJobTitle: resumeMeta?.targetJobTitle || undefined,
        template: 'resume-template-01',
        summary: content.summary || undefined,
        content: content as unknown as Record<string, unknown>,
      });
      return selectedId;
    }
    const created = await createResume({
      title: 'ATS Resume',
      template: 'resume-template-01',
      summary: content.summary || undefined,
      content: content as unknown as Record<string, unknown>,
    });
    setSelectedId(created.id);
    setResumeMeta(created);
    return created.id;
  }

  if (master) {
    return (
      <CandidateAppShell activeTab="ats" title="ATS Score" maxWidth="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <ResumeAtsTopSwitcher active="ats" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              How ATS-friendly is {selectedLabel || 'this resume'}? (Not a job match score.)
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMaster(null);
              router.replace('/ats');
            }}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Pick another resume
          </button>
        </div>
        <ResumePreviewScreen
          resume={master}
          targetJobTitle={resumeMeta?.targetJobTitle || undefined}
          resumeId={selectedId || undefined}
          resumeFileName={resumeMeta?.title}
          onEnsureSaved={ensureSaved}
          onResumeSaved={(id) => setSelectedId(id)}
          onSyncProfile={async () => {
            /* Profile stays independent — optional light touch via passport elsewhere */
          }}
          onBack={() => {
            setMaster(null);
            router.replace('/ats');
          }}
          onEdit={() => {
            if (selectedId) {
              router.push(`/resume`);
            }
          }}
          onApplySuggestion={applySuggestion}
        />
      </CandidateAppShell>
    );
  }

  return (
    <CandidateAppShell activeTab="ats" title="ATS Score">
      <div className="mx-auto max-w-3xl">
        <ResumeAtsTopSwitcher active="ats" />
        <h1 className="mt-3 text-2xl font-extrabold text-slate-900">Resume ATS Checker</h1>
        <p className="mt-1 text-sm text-slate-600">
          This is a <strong>Resume ATS / readiness score</strong> — how complete and ATS-friendly
          your resume is. Job match scores appear when you apply to a specific job.
        </p>

        {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}
        {loading || checking ? (
          <p className="mt-8 text-sm text-slate-500">{checking ? 'Opening ATS…' : 'Loading…'}</p>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">Add a resume first.</p>
            <Link
              href="/resumes"
              className="mt-4 inline-block rounded-xl bg-[#0a2e2c] px-4 py-2.5 text-sm font-bold text-white"
            >
              Go to View Resume
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {items.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-extrabold text-slate-900">{row.title}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    V{row.version}
                    {row.score ? ` · Last score ${row.score}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openAts(row.id)}
                  className="rounded-xl bg-[#0a2e2c] px-4 py-2 text-sm font-bold text-white hover:bg-[#072422]"
                >
                  Check ATS score
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CandidateAppShell>
  );
}

export default function AtsCheckerPage() {
  return (
    <Suspense
      fallback={
        <CandidateAppShell activeTab="ats" title="ATS Score">
          <p className="text-sm text-slate-500">Loading…</p>
        </CandidateAppShell>
      }
    >
      <AtsCheckerInner />
    </Suspense>
  );
}
