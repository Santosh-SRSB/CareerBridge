'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTemplateComponent } from '@/components/resume-templates/index.js';
import { ScoreRing } from '@/components/ScoreRing';
import {
  buildAccurateImproveSuggestions,
  evaluateAtsSections,
  isAdviceOnlyText,
  isTrivialTextChange,
} from '@/features/resume/resume-ai-review';
import type { ResumeAiSuggestion } from '@/features/resume/resume-ai-review';
import { masterResumeToAtsData } from '@/features/resume/master-to-ats-data';
import { masterResumeToResumeContent } from '@/features/resume/master-to-resume-content';
import type { MasterResumeDocument } from '@/features/resume/master-resume.types';
import { clearResumeUpdateMode } from '@/features/resume/resume-update-mode';
import { clearResumeFromBuild, clearResumeFromAutofill } from '@/features/resume/resume-wizard-draft';
import {
  aiReviewResume,
  analyzeResumeRole,
  createResume,
  downloadResume,
  getResume,
} from '@/lib/api';
import { downloadMasterResumePdf } from '@/lib/master-resume-pdf';
import '@/components/resume-templates/ats-template.css';
import '@/components/resume-templates/resume-template-01.css';

type AtsPhase = 'ready' | 'analyzing' | 'report' | 'improve' | 'done';

type SectionRow = {
  key: string;
  label: string;
  status: 'good' | 'needs_work' | 'missing' | 'fix_needed';
  note: string;
  present: boolean;
};

type AtsReport = {
  overallScore: number;
  headline: string;
  detail: string;
  formatting: number;
  sectionCompleteness: number;
  readability: number;
  sections: SectionRow[];
  formattingIssues: string[];
};

const ANALYZE_STEPS = [
  'Reading education',
  'Scanning skills & sections',
  'Reviewing experience',
] as const;

function asNumber(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function reportHeadline(score: number): string {
  if (score >= 80) return 'Impressive — strong ATS readiness';
  if (score >= 70) return 'Solid score — a few gaps to close';
  if (score >= 60) return 'Fair score — improve a few sections';
  return 'Improvement needed — several gaps found';
}

function reportDetail(score: number, sections: SectionRow[]): string {
  const missing = sections.filter((s) => s.status === 'missing').map((s) => s.label);
  const weak = sections.filter(
    (s) => s.status === 'needs_work' || s.status === 'fix_needed',
  );
  if (missing.length === 1) {
    return `Your resume parses, but ${missing[0]} is missing. Add it to raise your score.`;
  }
  if (missing.length > 1) {
    return `Your resume parses, but ${missing.slice(0, 3).join(', ')} are missing. Complete those sections to raise your score.`;
  }
  if (weak.length === 0) {
    return 'Your resume parses cleanly and core sections look ATS-ready.';
  }
  if (weak.length <= 2) {
    return `Your resume parses cleanly. Tighten ${weak.map((s) => s.label).join(' and ')} to raise your score.`;
  }
  if (score >= 70) {
    return 'Your resume parses cleanly and covers most core sections. A few section improvements can raise your score.';
  }
  return 'Strengthen section coverage and ATS-friendly formatting so parsers can read your resume reliably.';
}

function statusLabel(status: SectionRow['status']) {
  if (status === 'good') return 'Good';
  if (status === 'needs_work') return 'Needs work';
  if (status === 'missing') return 'Missing';
  return 'Fix needed';
}

function mapAtsReport(raw: Record<string, unknown>, doc: MasterResumeDocument): AtsReport {
  const formattingIssues = asStringArray(raw.formattingIssues);
  const templateAnalysis =
    raw.templateAnalysis && typeof raw.templateAnalysis === 'object'
      ? (raw.templateAnalysis as Record<string, unknown>)
      : {};

  const layoutIssues = formattingIssues.filter(
    (issue) => !/linkedin|portfolio|github|keyword|job posting/i.test(issue),
  );
  const formatting = asNumber(raw.atsFormatting, 90);

  const evaluated = evaluateAtsSections(doc, {
    formattingScore: formatting,
    layoutIssues,
  });

  const sections: SectionRow[] = evaluated.map((s) => ({
    key: s.key,
    label: s.label,
    status: s.status,
    note: s.note,
    present: s.present,
  }));

  const presentCount = sections.filter((s) => s.key !== 'formatting' && s.present).length;
  const tracked = sections.filter((s) => s.key !== 'formatting').length || 1;
  const sectionCompleteness = Math.round((presentCount / tracked) * 100);
  const readability = Math.min(
    100,
    Math.max(
      0,
      asNumber(
        templateAnalysis.machineReadability ?? templateAnalysis.readingOrder ?? raw.templateScore,
        formatting,
      ),
    ),
  );

  const sectionQuality = Math.round(
    sections
      .filter((s) => s.key !== 'formatting')
      .reduce((sum, s) => {
        if (s.status === 'missing') return sum + 0;
        if (s.status === 'fix_needed') return sum + 40;
        if (s.status === 'needs_work') return sum + 65;
        return sum + 92;
      }, 0) / tracked,
  );
  const structureScore = Math.round(
    formatting * 0.3 + sectionCompleteness * 0.25 + readability * 0.2 + sectionQuality * 0.25,
  );

  return {
    overallScore: structureScore,
    headline: reportHeadline(structureScore),
    detail: reportDetail(structureScore, sections),
    formatting,
    sectionCompleteness,
    readability,
    sections,
    formattingIssues: layoutIssues,
  };
}

interface ResumePreviewScreenProps {
  resume: MasterResumeDocument;
  targetJobTitle?: string;
  resumeId?: string;
  resumeFileName?: string;
  onEnsureSaved?: () => Promise<string>;
  onResumeSaved?: (resumeId: string) => void;
  /** Persist master resume fields into Career Passport so dashboard completion updates. */
  onSyncProfile?: () => Promise<void>;
  onBack: () => void;
  onEdit: () => void;
  onAddSection?: (sectionLabel: string) => void;
  onApplySuggestion: (suggestion: ResumeAiSuggestion, improvedText: string) => void;
}

export function ResumePreviewScreen({
  resume,
  targetJobTitle,
  resumeId,
  resumeFileName,
  onEnsureSaved,
  onResumeSaved,
  onSyncProfile,
  onBack,
  onEdit,
  onAddSection,
  onApplySuggestion,
}: ResumePreviewScreenProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<AtsPhase>('ready');
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [report, setReport] = useState<AtsReport | null>(null);
  const [error, setError] = useState('');
  const [fileMeta, setFileMeta] = useState<{ name: string; sizeLabel: string }>({
    name: resumeFileName || `${resume.personalInfo.fullName || 'My'} Resume`,
    sizeLabel: 'Saved',
  });
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [regeneratedTexts, setRegeneratedTexts] = useState<Record<string, string>>({});
  const [gatewaySuggestions, setGatewaySuggestions] = useState<ResumeAiSuggestion[]>([]);
  const [goodSections, setGoodSections] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [fileName, setFileName] = useState('ImprovedResume');
  const [savingVersion, setSavingVersion] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedVersionId, setSavedVersionId] = useState<string | null>(null);
  const [savedVersionTitle, setSavedVersionTitle] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const resumeRef = useRef(resume);
  resumeRef.current = resume;

  const templateData = useMemo(() => masterResumeToAtsData(resume), [resume]);
  const Template = getTemplateComponent('resume-template-01');
  const activeSuggestions = gatewaySuggestions.filter(
    (s) => !dismissedIds.has(s.id) && !appliedIds.has(s.id),
  );
  const allSuggestionsHandled =
    gatewaySuggestions.length === 0 ||
    dismissedIds.size + appliedIds.size >= gatewaySuggestions.length;

  useEffect(() => {
    let cancelled = false;
    if (!resumeId) return;
    void getResume(resumeId)
      .then((record) => {
        if (cancelled) return;
        const title = record.title?.trim() || resumeFileName;
        const kb = record.rawText ? Math.max(1, Math.round(record.rawText.length / 1024)) : null;
        setFileMeta({
          name: title || fileMeta.name,
          sizeLabel: kb ? `Uploaded • ${kb} KB` : 'Uploaded',
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  useEffect(() => {
    if (phase !== 'analyzing') return;
    setAnalyzeStep(0);
    const timer = window.setInterval(() => {
      setAnalyzeStep((prev) => Math.min(prev + 1, ANALYZE_STEPS.length - 1));
    }, 1800);
    return () => window.clearInterval(timer);
  }, [phase]);

  async function runAtsAnalysis() {
    setError('');
    setPhase('analyzing');
    setAnalyzeStep(0);
    try {
      const id = onEnsureSaved ? await onEnsureSaved() : resumeId;
      if (id) onResumeSaved?.(id);
      // Structure/ATS readiness only — do not score against a specific job role.
      const raw = (await analyzeResumeRole({
        resumeId: id || undefined,
        targetRole: 'General Professional',
        resume: masterResumeToAtsData(resumeRef.current) as unknown as Record<string, unknown>,
      })) as Record<string, unknown>;
      setReport(mapAtsReport(raw, resumeRef.current));
      setPhase('report');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check ATS score.');
      setPhase('ready');
    }
  }

  async function startImproveWithAi() {
    setPhase('improve');
    setAiLoading(true);
    setAiError('');
    setDismissedIds(new Set());
    setAppliedIds(new Set());
    setRegeneratedTexts({});
    setGatewaySuggestions([]);
    setGoodSections([]);
    try {
      const id = onEnsureSaved ? await onEnsureSaved() : resumeId;
      if (!id) throw new Error('Save your resume before using Improve with AI.');
      onResumeSaved?.(id);

      let gatewayRes: Record<string, unknown> | null = null;
      try {
        gatewayRes = (await aiReviewResume(id, {
          targetRole: 'General Professional',
        })) as Record<string, unknown>;
      } catch {
        gatewayRes = null;
      }

      const built = buildAccurateImproveSuggestions(
        resumeRef.current,
        gatewayRes as Parameters<typeof buildAccurateImproveSuggestions>[1],
        report?.sections || [],
      );

      setGoodSections(built.goodSections);
      setGatewaySuggestions(built.suggestions);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not load AI improvements.');
    } finally {
      setAiLoading(false);
    }
  }

  function handleAccept(suggestion: ResumeAiSuggestion) {
    const improvedText = regeneratedTexts[suggestion.id] ?? suggestion.improvedText;
    // Never write coaching/ATS notes or tiny punctuation-only patches into the resume.
    if (
      isAdviceOnlyText(improvedText, suggestion.currentText) ||
      isTrivialTextChange(suggestion.currentText, improvedText)
    ) {
      setDismissedIds((prev) => new Set(prev).add(suggestion.id));
      return;
    }
    onApplySuggestion(suggestion, improvedText);
    setAppliedIds((prev) => new Set(prev).add(suggestion.id));
  }

  function handleReject(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id));
  }

  async function confirmSaveVersion() {
    const title = fileName.trim() || 'ImprovedResume';
    setSavingVersion(true);
    setSaveError('');
    try {
      // Persist edits first (optional), then always create a NEW version — never overwrite.
      if (onEnsureSaved) await onEnsureSaved();
      const content = masterResumeToResumeContent(resume);
      const created = await createResume({
        title,
        targetJobTitle: targetJobTitle?.trim() || undefined,
        template: 'resume-template-01',
        summary: content.summary || undefined,
        content: content as unknown as Record<string, unknown>,
        parentResumeId: resumeId || undefined,
      });
      // Cloud + Postgres via create; download is optional on the done screen.
      try {
        await downloadResume(created.id);
      } catch {
        /* cloud sync optional */
      }
      try {
        await onSyncProfile?.();
      } catch {
        /* resume saved; passport can retry on dashboard open */
      }
      onResumeSaved?.(created.id);
      setSavedVersionId(created.id);
      setSavedVersionTitle(title);
      setShowSaveDialog(false);
      setPhase('done');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this resume version.');
    } finally {
      setSavingVersion(false);
    }
  }

  async function goToDashboard() {
    clearResumeFromBuild();
    clearResumeFromAutofill();
    try {
      await onSyncProfile?.();
    } catch {
      /* still navigate */
    }
    router.push('/dashboard');
  }

  async function handleDownload() {
    if (downloading || downloadSuccess) return;
    setDownloading(true);
    setDownloadError('');
    try {
      clearResumeUpdateMode();
      // Always build local PDF with CareerBridge template + current resume data
      // (never the original uploaded file layout).
      await downloadMasterResumePdf(
        resume,
        `${(savedVersionTitle || resume.personalInfo.fullName || 'Resume').replace(/\s+/g, '-')}.pdf`,
      );
      // Best-effort cloud sync with our template (optional).
      if (savedVersionId) {
        try {
          await downloadResume(savedVersionId);
        } catch {
          /* local download already succeeded */
        }
      }
      setDownloadSuccess(true);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download your resume.');
    } finally {
      setDownloading(false);
    }
  }

  const metric = (label: string, value: number, warn = false) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}%</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${warn ? 'bg-[#e68a39]' : 'bg-[#0a2e2c]'}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-[#f7f6f2] px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Resume tools
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            {phase === 'improve' || phase === 'done' ? 'Improve with AI' : 'Check ATS score'}
          </h1>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Back
        </button>
      </div>

      {phase === 'ready' ? (
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#0a2e2c]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 4h7l4 4v12a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-slate-900">{fileMeta.name}</p>
              <p className="text-xs font-medium text-slate-500">{fileMeta.sizeLabel}</p>
            </div>
            <button
              type="button"
              onClick={onEdit}
              className="text-sm font-bold text-[#0a2e2c] hover:underline"
            >
              Replace
            </button>
          </div>

          {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={() => void runAtsAnalysis()}
            className="mt-5 w-full rounded-xl bg-[#0a2e2c] py-3.5 text-sm font-bold text-white transition hover:bg-[#072422]"
          >
            Check ATS score
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">
            Takes about 15 seconds. We scan structure, sections and formatting.
          </p>
        </div>
      ) : null}

      {phase === 'analyzing' ? (
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#0a2e2c]" />
          <h2 className="mt-5 text-xl font-extrabold text-slate-900">Analyzing your resume</h2>
          <p className="mt-1 text-sm text-slate-500">This usually takes about 15 seconds</p>
          <ol className="mt-6 space-y-3 text-left">
            {ANALYZE_STEPS.map((label, index) => {
              const done = index < analyzeStep;
              const active = index === analyzeStep;
              return (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      done || active
                        ? 'bg-[#0a2e2c] text-white'
                        : 'border border-slate-300 text-slate-400'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      done || active ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {phase === 'report' && report ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ScoreRing value={report.overallScore} size={110} label="/ 100" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  ATS compatibility
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">{report.headline}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{report.detail}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Overall score</span>
                <span>{report.overallScore}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    report.overallScore < 70 ? 'bg-[#e68a39]' : 'bg-[#0a2e2c]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, report.overallScore))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {metric('Formatting', report.formatting, report.formatting < 70)}
            {metric(
              'Section completeness',
              report.sectionCompleteness,
              report.sectionCompleteness < 70,
            )}
            {metric('Readability', report.readability, report.readability < 70)}
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-extrabold text-slate-900">Section-by-section</h3>
            {report.sections.map((section) => (
              <div
                key={section.key}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  section.status === 'good'
                    ? 'border-emerald-200 border-l-4 border-l-emerald-500'
                    : section.status === 'missing' || section.status === 'fix_needed'
                      ? 'border-red-200 border-l-4 border-l-red-500'
                      : 'border-orange-200 border-l-4 border-l-orange-400'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{section.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{section.note}</p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold ${
                      section.status === 'good'
                        ? 'text-emerald-600'
                        : section.status === 'needs_work'
                          ? 'text-orange-600'
                          : 'text-red-600'
                    }`}
                  >
                    {statusLabel(section.status)}
                  </span>
                </div>
                {section.status === 'missing' ? (
                  <button
                    type="button"
                    onClick={() => onAddSection?.(section.label)}
                    className="mt-3 rounded-lg bg-[#0a2e2c] px-3 py-2 text-xs font-bold text-white hover:bg-[#072422]"
                  >
                    Add {section.label}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void startImproveWithAi()}
            className="w-full rounded-xl bg-[#e68a39] py-3.5 text-sm font-bold text-[#0a2e2c] transition hover:bg-[#f0a04e]"
          >
            Improve with AI
          </button>
        </div>
      ) : null}

      {phase === 'improve' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">Suggested improvements</h2>
            <p className="mt-1 text-sm text-slate-600">
              Based on your ATS report: real wording fixes only. Sections marked Good stay
              untouched.
            </p>
            {aiLoading ? (
              <p className="mt-4 text-sm font-semibold text-[#0a2e2c]">Building improvements…</p>
            ) : null}
            {aiError ? <p className="mt-3 text-sm font-semibold text-red-600">{aiError}</p> : null}

            {!aiLoading && goodSections.length ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                  Good for ATS
                </p>
                <ul className="mt-2 space-y-1">
                  {goodSections.map((label) => (
                    <li key={label} className="text-sm font-semibold text-emerald-900">
                      ✓ {label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!aiLoading && activeSuggestions.length === 0 ? (
              <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                {gatewaySuggestions.length
                  ? 'All suggestions reviewed. Save this improved version.'
                  : report?.sections.some((s) => s.status !== 'good')
                    ? 'No auto-fix available for the remaining gaps — use Add section / edit in the wizard, then re-check ATS.'
                    : 'No edits needed — your sections look accurate for ATS. You can save or go back.'}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              {activeSuggestions.map((suggestion, index) => (
                <div key={suggestion.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {index + 1} of {gatewaySuggestions.length} · {suggestion.sectionLabel}
                  </p>
                  {suggestion.issue ? (
                    <p className="mt-1 text-sm font-semibold text-amber-800">{suggestion.issue}</p>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-red-50 p-3 text-xs text-slate-700">
                      <p className="mb-1 font-bold text-red-700">Current</p>
                      {suggestion.currentText}
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 text-xs text-slate-700">
                      <p className="mb-1 font-bold text-emerald-700">Suggested</p>
                      {regeneratedTexts[suggestion.id] ?? suggestion.improvedText}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAccept(suggestion)}
                      className="rounded-lg bg-[#0a2e2c] px-3 py-2 text-xs font-bold text-white"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(suggestion.id)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <Template data={templateData} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPhase('report')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            >
              Back to report
            </button>
            <button
              type="button"
              disabled={!allSuggestionsHandled && activeSuggestions.length > 0}
              onClick={() => {
                setFileName(
                  targetJobTitle?.trim()
                    ? `${targetJobTitle.trim()} Resume`
                    : 'ImprovedResume',
                );
                setSaveError('');
                setShowSaveDialog(true);
              }}
              className="flex-1 rounded-xl bg-[#0a2e2c] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'done' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Saved as “{savedVersionTitle}” (new version). Download is optional.
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <Template data={templateData} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={downloading || downloadSuccess}
              onClick={() => void handleDownload()}
              className="flex-1 rounded-xl bg-[#0a2e2c] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {downloading ? 'Generating…' : downloadSuccess ? 'Downloaded' : 'Download (optional)'}
            </button>
            <button
              type="button"
              onClick={() => void goToDashboard()}
              className="flex-1 rounded-xl bg-[#e68a39] px-4 py-3 text-sm font-bold text-[#0a2e2c]"
            >
              Candidate Dashboard
            </button>
          </div>
          {downloadError ? <p className="text-sm font-semibold text-red-600">{downloadError}</p> : null}
        </div>
      ) : null}

      {showSaveDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-extrabold text-slate-900">Save resume version</h2>
            <p className="mt-1 text-sm text-slate-600">
              Name this improved copy. It will be stored in the cloud as a new version.
            </p>
            <input
              autoFocus
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="ImprovedResume or Mern resume"
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#0a2e2c]"
            />
            {saveError ? <p className="mt-2 text-sm font-semibold text-red-600">{saveError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={savingVersion}
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingVersion || !fileName.trim()}
                onClick={() => void confirmSaveVersion()}
                className="flex-1 rounded-xl bg-[#0a2e2c] py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingVersion ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
