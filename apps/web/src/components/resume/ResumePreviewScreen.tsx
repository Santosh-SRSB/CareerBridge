'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTemplateComponent } from '@/components/resume-templates/index.js';
import { mapGatewayReviewToSuggestions } from '@/features/resume/resume-ai-review';
import type { ResumeAiSuggestion } from '@/features/resume/resume-ai-review';
import { masterResumeToAtsData } from '@/features/resume/master-to-ats-data';
import type { MasterResumeDocument } from '@/features/resume/master-resume.types';
import { clearResumeUpdateMode } from '@/features/resume/resume-update-mode';
import { aiReviewResume } from '@/lib/api';
import { downloadMasterResumePdf } from '@/lib/master-resume-pdf';
import '@/components/resume-templates/ats-template.css';
import '@/components/resume-templates/resume-template-01.css';

const MOBILE_BREAKPOINT = 768;
const SHEET_WIDTH = 794;

function getIsMobile() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

interface ResumePreviewScreenProps {
  resume: MasterResumeDocument;
  targetJobTitle?: string;
  resumeId?: string;
  /** Persist current resume content and return its id before Gateway review */
  onEnsureSaved?: () => Promise<string>;
  onResumeSaved?: (resumeId: string) => void;
  onBack: () => void;
  onEdit: () => void;
  onApplySuggestion: (suggestion: ResumeAiSuggestion, improvedText: string) => void;
}

export function ResumePreviewScreen({
  resume,
  targetJobTitle,
  resumeId,
  onEnsureSaved,
  onResumeSaved,
  onBack,
  onEdit,
  onApplySuggestion,
}: ResumePreviewScreenProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [regeneratedTexts, setRegeneratedTexts] = useState<Record<string, string>>({});
  const [downloadError, setDownloadError] = useState('');
  const [aiFlowComplete, setAiFlowComplete] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRetrying, setAiRetrying] = useState(false);
  const [aiError, setAiError] = useState('');
  const [gatewaySuggestions, setGatewaySuggestions] = useState<ResumeAiSuggestion[]>([]);
  const [reviewScore, setReviewScore] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isMobile, setIsMobile] = useState(getIsMobile);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const templateData = useMemo(() => masterResumeToAtsData(resume), [resume]);
  const Template = getTemplateComponent('resume-template-01');

  const activeSuggestions = gatewaySuggestions.filter(
    (s) => !dismissedIds.has(s.id) && !appliedIds.has(s.id),
  );

  useLayoutEffect(() => {
    setIsMobile(getIsMobile());
  }, []);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const updateLayout = () => {
      const mobile = getIsMobile();
      setIsMobile(mobile);

      if (mobile || showAi) {
        setScale(1);
        return;
      }

      const available = el.clientWidth;
      setScale(available < SHEET_WIDTH ? available / SHEET_WIDTH : 1);
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(el);
    window.addEventListener('resize', updateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, [showAi]);

  useEffect(() => {
    if (!showAi || aiLoading || aiError) return;
    if (activeSuggestions.length === 0) {
      setAiFlowComplete(true);
    }
  }, [showAi, aiLoading, aiError, activeSuggestions.length]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  async function handleDownload() {
    if (downloading || downloadSuccess) return;
    setDownloading(true);
    setDownloadError('');
    try {
      clearResumeUpdateMode();
      await downloadMasterResumePdf(resume);
      if (onEnsureSaved) {
        try {
          const id = await onEnsureSaved();
          onResumeSaved?.(id);
        } catch {
          onResumeSaved?.(resumeId || '');
        }
      } else {
        onResumeSaved?.(resumeId || '');
      }
      setDownloadSuccess(true);
      redirectTimerRef.current = window.setTimeout(() => {
        router.push('/resume/upload');
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setDownloadError(message || 'Could not download your resume. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  async function fetchGatewayReview(existingId?: string) {
    const id =
      (onEnsureSaved ? await onEnsureSaved() : null) ||
      existingId ||
      resumeId;
    if (!id) {
      throw new Error('Save your resume before using Improve with AI.');
    }
    onResumeSaved?.(id);
    const res = await aiReviewResume(id, {
      targetRole: targetJobTitle?.trim() || 'General Professional',
    });
    const mapped = mapGatewayReviewToSuggestions(res, resume);
    setGatewaySuggestions(mapped.suggestions);
    setReviewScore(typeof mapped.score === 'number' ? mapped.score : null);
    return mapped;
  }

  function handleAccept(suggestion: ResumeAiSuggestion) {
    const improvedText = regeneratedTexts[suggestion.id] ?? suggestion.improvedText;
    onApplySuggestion(suggestion, improvedText);
    setAppliedIds((prev) => new Set(prev).add(suggestion.id));
  }

  function handleIgnore(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id));
  }

  async function handleTryAgain(suggestion: ResumeAiSuggestion) {
    if (aiRetrying || aiLoading) return;
    setAiRetrying(true);
    setAiError('');
    try {
      const mapped = await fetchGatewayReview();
      const refreshed =
        mapped.suggestions.find((item) => item.id === suggestion.id) ||
        mapped.suggestions.find((item) => item.section === suggestion.section);
      if (refreshed?.improvedText) {
        setRegeneratedTexts((prev) => ({
          ...prev,
          [suggestion.id]: refreshed.improvedText,
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not refresh AI suggestion.';
      setAiError(message);
    } finally {
      setAiRetrying(false);
    }
  }

  async function openAiPanel() {
    setShowAi(true);
    setAiFlowComplete(false);
    setDismissedIds(new Set());
    setAppliedIds(new Set());
    setRegeneratedTexts({});
    setGatewaySuggestions([]);
    setReviewScore(null);
    setAiError('');
    setAiLoading(true);
    try {
      const mapped = await fetchGatewayReview();
      if (mapped.suggestions.length === 0) {
        setAiFlowComplete(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not complete AI review.';
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  }

  const scaleMarginBottom = !isMobile && !showAi && scale < 1 ? -(SHEET_WIDTH * (1 - scale) * 1.35) : 0;

  function renderSuggestionCard(suggestion: ResumeAiSuggestion) {
    const originalIndex = gatewaySuggestions.findIndex((s) => s.id === suggestion.id);

    return (
      <div key={suggestion.id} className="cb-ai-section-card">
        <p className="cb-ai-progress">
          Section {originalIndex + 1} of {gatewaySuggestions.length}
        </p>
        <h3 className="cb-ai-section-name">{suggestion.sectionLabel}</h3>
        {suggestion.issue ? <p className="cb-ai-issue">{suggestion.issue}</p> : null}

        <div className="cb-ai-block">
          <span className="cb-ai-block-label">Current</span>
          <p className="cb-ai-current-text">&ldquo;{suggestion.currentText}&rdquo;</p>
        </div>

        <div className="cb-ai-block">
          <span className="cb-ai-block-label">AI Suggestion</span>
          <div className="cb-ai-suggestion-box">
            {regeneratedTexts[suggestion.id] ?? suggestion.improvedText}
          </div>
        </div>

        <div className="cb-ai-card-actions">
          <button
            type="button"
            className="cb-ai-action-btn is-accept"
            onClick={() => handleAccept(suggestion)}
          >
            Apply
          </button>
          <button
            type="button"
            className="cb-ai-action-btn is-ignore"
            onClick={() => handleIgnore(suggestion.id)}
          >
            Ignore
          </button>
          <button
            type="button"
            className="cb-ai-action-btn is-retry"
            onClick={() => void handleTryAgain(suggestion)}
            disabled={aiRetrying || aiLoading}
          >
            {aiRetrying ? 'Refreshing…' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  function renderImprovePanel() {
    return (
      <div className="cb-ai-improve-box">
        <h2 className="cb-ai-title">
          Improve Your <mark>Resume</mark>
        </h2>

        {aiLoading ? (
          <p className="cb-ai-subtitle">Reviewing your resume with AI (Gateway + RAG)…</p>
        ) : null}

        {aiError ? <p className="cb-ai-error">{aiError}</p> : null}

        {!aiLoading && !aiError && aiFlowComplete ? (
          <>
            <div className="cb-ai-all-good">All your sections look good!</div>
            <p className="cb-ai-subtitle is-complete">
              You&apos;ve reviewed every suggested improvement. Your resume is ready.
            </p>
            {reviewScore != null ? (
              <p className="cb-ai-score">AI score: {reviewScore}/100</p>
            ) : null}
          </>
        ) : null}

        {!aiLoading && !aiError && !aiFlowComplete ? (
          <>
            <p className="cb-ai-subtitle">
              {reviewScore != null
                ? `AI score ${reviewScore}/100 — review each suggestion below.`
                : 'We found some opportunities to improve it.'}
            </p>
            {activeSuggestions.length > 0 ? (
              <div className="cb-ai-sections-list">
                {activeSuggestions.map((suggestion) => renderSuggestionCard(suggestion))}
              </div>
            ) : (
              <div className="cb-ai-all-good">All your sections look good!</div>
            )}
          </>
        ) : null}
      </div>
    );
  }


  const resumePanel = (
    <div className="cb-preview-frame-wrap" ref={frameRef}>
      <div
        className="cb-preview-scale-inner"
        style={{
          transform: !isMobile && !showAi && scale < 1 ? `scale(${scale})` : undefined,
          marginBottom: scaleMarginBottom || undefined,
        }}
      >
        <div className="cb-preview-sheet">
          <Template data={templateData} />
        </div>
      </div>
    </div>
  );

  return (
    <div className={`cb-preview-page${showAi ? ' cb-preview-page-ai-open' : ''}`}>
        {downloadSuccess ? (
        <div className="cb-download-success-overlay" role="status" aria-live="polite">
          <div className="cb-download-success-card">
            <p>Your resume downloaded to your device.</p>
            <p>Taking you to upload resume…</p>
          </div>
        </div>
      ) : null}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .cb-preview-page {
          max-width: 920px;
          margin: 0 auto;
          padding: 24px 16px 60px;
        }
        .cb-preview-head-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .cb-preview-head-row h1 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 22px;
          margin: 0;
          color: #142a4f;
          flex: 1;
          min-width: 0;
        }
        .cb-preview-head-row .cb-flow-back-btn {
          flex-shrink: 0;
          padding-top: 4px;
        }
        .cb-flow-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 0;
          background: none;
          border: none;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #142a4f;
          cursor: pointer;
        }
        .cb-flow-back-btn:hover { color: #43526b; }
        .cb-preview-body {
          display: block;
          position: relative;
        }
        .cb-preview-page-ai-open .cb-preview-body.is-ai-stacked {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cb-ai-stack {
          flex-shrink: 0;
        }
        .cb-preview-page-ai-open .cb-preview-body.is-ai-stacked .cb-preview-frame-wrap {
          flex-shrink: 0;
        }
        .cb-preview-frame-wrap {
          background: #f0f0f0;
          border-radius: 12px;
          padding: 12px;
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        .cb-preview-scale-inner {
          transform-origin: top center;
          margin: 0 auto;
          width: min(100%, ${SHEET_WIDTH}px);
          max-width: 100%;
        }
        .cb-preview-sheet {
          width: 100%;
          background: #fff;
          border: 2px solid #000;
          box-shadow: 0 4px 24px -8px rgba(0, 0, 0, 0.2);
          box-sizing: border-box;
          overflow-x: hidden;
        }
        .cb-preview-page-ai-open .cb-preview-scale-inner,
        .cb-preview-page-ai-open .cb-preview-sheet {
          width: 100%;
          max-width: 100%;
        }
        .cb-preview-actions {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 20px;
          width: 100%;
          position: relative;
          z-index: 1;
          clear: both;
        }
        .cb-preview-actions.is-complete .cb-preview-btn {
          flex: 1 1 0;
        }
        .cb-preview-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 20px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          border: none;
          font-family: 'Inter', sans-serif;
        }
        .cb-preview-btn-primary { background: #142a4f; color: #fff; }
        .cb-preview-btn-ghost {
          background: transparent;
          color: #142a4f;
          border: 1.5px solid #dde0d3;
        }
        .cb-preview-btn-marigold { background: #e29a34; color: #142a4f; }
        .cb-ai-improve-box {
          border: 2px solid #000;
          border-radius: 4px;
          background: #fff;
          padding: 18px 16px 14px;
          box-sizing: border-box;
        }
        .cb-ai-improve-box.is-compact {
          border: none;
          padding: 0;
          background: transparent;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .cb-ai-title {
          margin: 0 0 6px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #142a4f;
        }
        .cb-ai-title mark {
          background: #fde047;
          color: inherit;
          padding: 0 2px;
        }
        .cb-ai-subtitle {
          margin: 0 0 16px;
          font-size: 14px;
          color: #333;
        }
        .cb-ai-section-card {
          margin-bottom: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid #e5e7df;
          position: relative;
          z-index: 1;
          isolation: isolate;
          background: #fff;
        }
        .cb-ai-sections-list .cb-ai-section-card:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }
        .cb-ai-subtitle.is-complete {
          margin-top: 0;
          margin-bottom: 0;
        }
        .cb-ai-progress {
          margin: 0 0 8px;
          font-size: 11px;
          font-weight: 600;
          color: #5a431b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .cb-ai-section-name {
          margin: 0 0 12px;
          font-size: 15px;
          font-weight: 700;
          color: #142a4f;
        }
        .cb-ai-issue {
          margin: -6px 0 12px;
          font-size: 13px;
          color: #5a431b;
        }
        .cb-ai-error {
          margin: 0 0 12px;
          padding: 10px 12px;
          border-radius: 6px;
          background: #fdeaea;
          border: 1px solid #f5c6c6;
          color: #991b1b;
          font-size: 13px;
        }
        .cb-ai-score {
          margin: 8px 0 0;
          font-size: 13px;
          font-weight: 600;
          color: #142a4f;
        }
        .cb-ai-block {
          margin-bottom: 12px;
        }
        .cb-ai-block-label {
          display: block;
          margin-bottom: 4px;
          font-size: 13px;
          font-weight: 700;
          color: #142a4f;
        }
        .cb-ai-current-text {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: #333;
          white-space: pre-line;
          background: #fdeaea;
          border: 1px solid #f5c6c6;
          border-radius: 2px;
          padding: 10px 12px;
        }
        .cb-ai-suggestion-box {
          border: 1px solid #b8dcc8;
          border-radius: 2px;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.45;
          color: #111;
          background: #e8f5ef;
          white-space: pre-line;
        }
        .cb-ai-card-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
          position: relative;
          z-index: 2;
          background: #fff;
        }
        .cb-ai-action-btn {
          min-width: 88px;
          padding: 9px 14px;
          border: 1.5px solid #000;
          border-radius: 2px;
          background: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #142a4f;
          cursor: pointer;
        }
        .cb-ai-action-btn.is-accept {
          background: #142a4f;
          color: #fff;
          border-color: #142a4f;
        }
        .cb-ai-action-btn:hover {
          opacity: 0.92;
        }
        .cb-ai-all-good {
          padding: 14px;
          background: #e8f5ef;
          border-radius: 6px;
          border: 1px solid #b8dcc8;
          font-size: 13.5px;
          color: #1c4a38;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .cb-download-error {
          margin-top: 10px;
          font-size: 13px;
          color: #8b2e26;
          text-align: center;
        }
        .cb-download-success-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(20, 42, 79, 0.45);
          backdrop-filter: blur(2px);
        }
        .cb-download-success-card {
          width: min(100%, 420px);
          background: #fff;
          border: 2px solid #142a4f;
          border-radius: 12px;
          padding: 28px 24px;
          text-align: center;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
        }
        .cb-download-success-card p {
          margin: 0;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          line-height: 1.5;
          color: #142a4f;
        }
        .cb-download-success-card p + p {
          margin-top: 10px;
          font-weight: 600;
          color: #1c4a38;
        }
        .cb-ai-mobile-stack,
        .cb-ai-stack {
          flex-shrink: 0;
        }
        .cb-ai-stack .cb-ai-improve-box,
        .cb-ai-mobile-stack .cb-ai-improve-box {
          border: 2px solid #000;
          background: #fff;
        }
        .cb-ai-stack .cb-ai-card-actions,
        .cb-ai-mobile-stack .cb-ai-card-actions {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          gap: 8px;
        }
        .cb-ai-stack .cb-ai-action-btn,
        .cb-ai-mobile-stack .cb-ai-action-btn {
          flex: 1 1 0;
          min-width: 0;
        }

        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          .cb-preview-page {
            max-width: none;
            width: 100%;
            height: 100dvh;
            min-height: 100dvh;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            overflow: hidden;
          }
          .cb-preview-head-row {
            flex-shrink: 0;
            margin: 0;
            padding: 12px 16px 10px;
            background: #f3f4ee;
            border-bottom: 1px solid #dde0d3;
          }
          .cb-preview-head-row h1 {
            font-size: 18px;
          }
          .cb-preview-body {
            flex: 1 1 auto;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .cb-preview-body.is-ai-stacked {
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }
          .cb-preview-body:not(.is-ai-stacked) .cb-preview-frame-wrap {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }
          .cb-preview-body.is-ai-stacked .cb-preview-frame-wrap {
            flex-shrink: 0;
            min-height: 280px;
            overflow: visible;
          }
          .cb-ai-stack {
            padding: 12px;
            background: #f3f4ee;
            border-bottom: 1px solid #dde0d3;
          }
          .cb-ai-stack .cb-ai-improve-box {
            padding: 14px 12px 12px;
          }
          .cb-ai-stack .cb-ai-title {
            font-size: 18px;
          }
          .cb-ai-stack .cb-ai-subtitle {
            font-size: 13px;
            margin-bottom: 12px;
          }
          .cb-ai-stack .cb-ai-current-text,
          .cb-ai-stack .cb-ai-suggestion-box {
            font-size: 12px;
          }
          .cb-ai-stack .cb-ai-card-actions {
            gap: 6px;
            margin-top: 12px;
          }
          .cb-ai-stack .cb-ai-action-btn {
            padding: 10px 6px;
            font-size: 11px;
          }
          .cb-preview-frame-wrap {
            width: 100%;
            border: none;
            border-radius: 0;
            padding: 12px;
            margin: 0;
            background: #f0f0f0;
            display: block;
          }
          .cb-preview-scale-inner {
            width: 100% !important;
            max-width: 100% !important;
            transform: none !important;
            margin: 0 !important;
            overflow: visible;
          }
          .cb-preview-sheet {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto;
            border: 2px solid #000;
            box-shadow: none;
          }
          .cb-preview-sheet .resume-template-01 {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            padding: 28px 20px;
            font-size: 10pt;
            overflow-wrap: anywhere;
          }
          .cb-preview-actions.is-complete .cb-preview-btn {
            flex: 1 1 0;
          }
          .cb-preview-actions {
            flex-shrink: 0;
            margin: 0;
            padding: 14px 12px calc(14px + env(safe-area-inset-bottom, 0px));
            background: transparent;
            border-top: none;
            gap: 6px;
            flex-wrap: nowrap;
            justify-content: center;
          }
          .cb-preview-btn {
            flex: 1 1 0;
            min-width: 0;
            padding: 10px 6px;
            font-size: 11px;
            white-space: nowrap;
          }
          .cb-preview-btn-primary {
            flex: 1 1 0;
          }
          .cb-download-error {
            padding: 0 16px 12px;
            margin: 0;
            flex-shrink: 0;
            text-align: center;
          }
        }
          `,
        }}
      />

      <div className="cb-preview-head-row">
        <h1>Resume Preview</h1>
        <button type="button" className="cb-flow-back-btn" onClick={onBack}>
          Back ←
        </button>
      </div>

      <div className={`cb-preview-body${showAi ? ' is-ai-stacked' : ''}`}>
        {showAi ? <div className="cb-ai-stack">{renderImprovePanel()}</div> : null}

        {resumePanel}

        <div className={`cb-preview-actions${aiFlowComplete ? ' is-complete' : ''}`}>
          <button type="button" className="cb-preview-btn cb-preview-btn-ghost" onClick={onEdit}>
            Edit
          </button>
          {!aiFlowComplete ? (
            <button
              type="button"
              className="cb-preview-btn cb-preview-btn-marigold"
              onClick={() => void openAiPanel()}
              disabled={aiLoading}
            >
              {aiLoading ? 'Reviewing…' : showAi ? 'Refresh AI' : 'Improve with AI'}
            </button>
          ) : (
            <button
              type="button"
              className="cb-preview-btn cb-preview-btn-marigold"
              onClick={() => router.push('/dashboard')}
            >
              Continue to Dashboard
            </button>
          )}
          <button
            type="button"
            className="cb-preview-btn cb-preview-btn-primary"
            onClick={() => void handleDownload()}
            disabled={downloading || downloadSuccess}
          >
            {downloading ? 'Generating...' : downloadSuccess ? 'Downloaded' : 'Download'}
          </button>
        </div>

        {downloadError ? <p className="cb-download-error">{downloadError}</p> : null}
      </div>
    </div>
  );
}
