'use client';

import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/Button';

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onCancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="ep-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
    >
      <button type="button" className="ep-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="ep-modal__card">
        <header className="ep-modal__head">
          <h2 id={titleId} className="ep-modal__title">
            {title}
          </h2>
          {message ? (
            <p id={messageId} className="ep-modal__sub">
              {message}
            </p>
          ) : null}
        </header>
        <footer className="ep-modal__actions">
          <Button ref={cancelRef} type="button" variant="secondary" block={false} disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'primary'}
            block={false}
            loading={busy}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}
