'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteAdminAccount, getAdminAccountDeletionPreview } from '@/lib/api';
import {
  type AdminAccountDeletionPreview,
  type AdminDeletableKind,
  DELETE_CONFIRM_WORD,
  deletionConfirmed,
  deletionKindLabel,
} from '@/lib/admin-account-deletion';
import { userFacingError } from '@/lib/client-errors';
import { StatusPill } from '@/components/super-admin/admin-tab-ui';

type DeleteTarget = { kind: AdminDeletableKind; id: string; name: string };

type Props = {
  target: DeleteTarget | null;
  onClose: () => void;
  onDeleted: (result: { kind: AdminDeletableKind; id: string; displayName: string }) => void;
};

export function AccountDeleteDialog({ target, onClose, onDeleted }: Props) {
  if (!target) return null;
  return (
    <DeleteDialogBody key={`${target.kind}:${target.id}`} target={target} onClose={onClose} onDeleted={onDeleted} />
  );
}

function DeleteDialogBody({ target, onClose, onDeleted }: Props & { target: DeleteTarget }) {
  const titleId = useId();
  const inputId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<AdminAccountDeletionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let active = true;
    getAdminAccountDeletionPreview(target.kind, target.id)
      .then((next) => active && setPreview(next))
      .catch((err) => active && setError(userFacingError(err, 'load the account details')))
      .finally(() => active && setLoading(false));
    const focus = window.setTimeout(() => cancelRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      active = false;
      window.clearTimeout(focus);
      document.removeEventListener('keydown', onKey);
    };
  }, [target.kind, target.id]);

  const label = deletionKindLabel(target.kind);
  const canConfirm = Boolean(preview?.deletable) && deletionConfirmed(typed) && !busy;

  async function confirm() {
    if (!canConfirm || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await deleteAdminAccount(target.kind, target.id);
      onDeleted({ kind: target.kind, id: target.id, displayName: result.displayName });
    } catch (err) {
      setError(userFacingError(err, `delete this ${label}`));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="ep-modal" role="alertdialog" aria-modal="true" aria-labelledby={titleId} data-testid="account-delete-dialog">
      <button
        type="button"
        className="ep-modal__backdrop"
        aria-label="Close"
        onClick={() => !busyRef.current && onClose()}
      />
      <div className="ep-modal__card">
        <header className="ep-modal__head">
          <h2 id={titleId} className="ep-modal__title text-[#b42318]">
            Permanently delete {label}?
          </h2>
          <p className="ep-modal__sub">
            {target.name} will be removed for good. This cannot be undone.
          </p>
        </header>

        <div className="space-y-3 px-1 text-sm text-[#333]">
          {loading ? <p className="text-[#666]">Checking the account…</p> : null}
          {preview ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{preview.displayName}</span>
                {preview.email ? <span className="text-xs text-[#666]">{preview.email}</span> : null}
                <StatusPill status={preview.accountStatus} />
              </div>
              {preview.blockers.length > 0 ? (
                <ul role="alert" className="space-y-1 border border-[#f3c4bd] bg-[#fdf1ef] px-3 py-2 text-[#b42318]">
                  {preview.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#999]">Also deleted</p>
                    <ul className="mt-1 grid grid-cols-1 gap-x-4 text-xs sm:grid-cols-2">
                      {preview.related.map((r) => (
                        <li key={r.label} className="flex justify-between gap-2">
                          <span>{r.label}</span>
                          <span className="font-bold tabular-nums">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#999]">Kept</p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-[#555]">
                      {preview.retained.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <label htmlFor={inputId} className="block text-xs font-semibold text-[#333]">
                    Type {DELETE_CONFIRM_WORD} to confirm
                  </label>
                  <input
                    id={inputId}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    disabled={busy}
                    className="w-full border border-[#ccc] px-3 py-2 text-sm"
                    data-testid="delete-confirm-input"
                  />
                </>
              )}
            </>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-[#b42318]">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="ep-modal__actions">
          <Button ref={cancelRef} type="button" variant="secondary" block={false} disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            block={false}
            loading={busy}
            disabled={!canConfirm}
            onClick={() => void confirm()}
            data-testid="delete-confirm-button"
          >
            Delete permanently
          </Button>
        </footer>
      </div>
    </div>
  );
}
