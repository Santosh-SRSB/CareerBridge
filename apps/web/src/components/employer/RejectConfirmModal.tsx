'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

type Props = {
  open: boolean;
  candidateName: string;
  jobTitle?: string;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

export function RejectConfirmModal({ open, candidateName, jobTitle, busy = false, error, onCancel, onConfirm }: Props) {
  const titleId = useId();
  const [reason, setReason] = useState('');
  const firstFocus = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setReason('');
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
          <p className="ep-modal__eyebrow">Reject</p>
          <h2 id={titleId} className="ep-modal__title">
            Reject this candidate?
          </h2>
          <p className="ep-modal__sub">
            {candidateName}
            {jobTitle ? ` · ${jobTitle}` : ''}. The candidate will be told they were not selected.
          </p>
        </header>

        <label className="ep-modal__field" htmlFor="ep-reject-reason">
          <span>Reason (optional, shared with the candidate)</span>
          <textarea
            ref={firstFocus}
            id="ep-reject-reason"
            value={reason}
            maxLength={500}
            rows={3}
            placeholder="e.g. We are looking for more experience with React."
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
          <em>{reason.length}/500</em>
        </label>

        {error ? (
          <p className="text-sm font-semibold text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="ep-modal__actions">
          <Button type="button" variant="secondary" block={false} disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            block={false}
            loading={busy}
            loadingLabel="Rejecting…"
            onClick={() => void onConfirm(reason.trim())}
          >
            Reject Candidate
          </Button>
        </footer>
      </div>
    </div>
  );
}
