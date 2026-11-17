'use client';

import { useEffect, useId, useMemo } from 'react';
import { base64OrTextToBlob, saveBase64File } from '@/lib/api';

type Props = {
  open: boolean;
  fileName: string;
  mimeType: string;
  /** Base64 PDF or HTML text content. */
  content: string;
  kind: 'pdf' | 'html';
  onClose: () => void;
};

/** In-page resume preview with optional download — no forced download on open. */
export function ResumePreviewModal({ open, fileName, mimeType, content, kind, onClose }: Props) {
  const titleId = useId();
  const previewUrl = useMemo(() => {
    if (!open || !content) return '';
    const blob = base64OrTextToBlob(content, mimeType, fileName);
    return URL.createObjectURL(blob);
  }, [open, content, mimeType, fileName]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !previewUrl) return null;

  return (
    <div className="ep-modal ep-modal--resume" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="ep-modal__backdrop" aria-label="Close resume preview" onClick={onClose} />
      <div className="ep-modal__card ep-modal__card--resume" style={{ width: '100vw', height: '100dvh', maxWidth: '100vw', maxHeight: '100dvh', margin: 0, borderRadius: 0 }}>
        <header className="ep-modal__head ep-modal__head--resume">
          <div>
            <p className="ep-modal__eyebrow">Resume</p>
            <h2 id={titleId} className="ep-modal__title">
              {fileName || 'Candidate resume'}
            </h2>
          </div>
          <div className="ep-modal__actions ep-modal__actions--resume">
            <button
              type="button"
              className="ev-btn ev-btn--ghost ev-btn--sm"
              onClick={() => saveBase64File(content, fileName || 'resume.pdf', mimeType)}
            >
              Download
            </button>
            <button type="button" className="ev-btn ev-btn--sm" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <div className="ep-resume-preview">
          {kind === 'pdf' ? (
            <iframe title="Resume preview" src={previewUrl} className="ep-resume-preview__frame" />
          ) : (
            <iframe title="Resume preview" src={previewUrl} className="ep-resume-preview__frame" sandbox="" />
          )}
        </div>
      </div>
    </div>
  );
}
