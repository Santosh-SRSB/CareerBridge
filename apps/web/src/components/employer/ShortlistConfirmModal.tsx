'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

type Props = {
  open: boolean;
  candidateName: string;
  jobTitle?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void | Promise<void>;
};

/** Handbook UT-E20 — shortlist confirmation modal with optional note. */
export function ShortlistConfirmModal({
  open,
  candidateName,
  jobTitle,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
  const [note, setNote] = useState('');
  const firstFocus = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setNote('');
      return;
    }
    const t = window.setTimeout(() => firstFocus.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div className="ep-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="ep-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="ep-modal__card">
        <header className="ep-modal__head">
          <p className="ep-modal__eyebrow">Shortlist</p>
          <h2 id={titleId} className="ep-modal__title">
            Shortlist {candidateName}?
          </h2>
          {jobTitle ? <p className="ep-modal__sub">For {jobTitle}</p> : null}
        </header>

        <label className="ep-modal__field" htmlFor="ep-shortlist-note">
          <span>Note (optional)</span>
          <textarea
            ref={firstFocus}
            id="ep-shortlist-note"
            value={note}
            maxLength={500}
            rows={3}
            placeholder="Add a private note for your hiring team…"
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
          />
          <em>{note.length}/500</em>
        </label>

        <footer className="ep-modal__actions">
          <Button type="button" variant="secondary" block={false} disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            block={false}
            loading={busy}
            loadingLabel="Shortlisting…"
            onClick={() => void onConfirm(note.trim())}
          >
            Shortlist candidate
          </Button>
        </footer>
      </div>
    </div>
  );
}
