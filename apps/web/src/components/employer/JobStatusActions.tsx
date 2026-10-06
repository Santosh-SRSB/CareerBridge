'use client';

import { useState } from 'react';
import { closeEmployerJob, pauseEmployerJob, publishEmployerJob } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { userFacingError } from '@/lib/client-errors';
import { jobPublishToast } from '@/lib/job-status';

const ACTION_TEXT = {
  publish: 'publish job',
  pause: 'pause job',
  close: 'close job',
} as const;

type Props = {
  jobId: string;
  status: string;
  onUpdated?: () => void | Promise<void>;
  compact?: boolean;
};

export function JobStatusActions({ jobId, status, onUpdated, compact = false }: Props) {
  const [busy, setBusy] = useState<'publish' | 'pause' | 'close' | null>(null);

  async function run(action: 'publish' | 'pause' | 'close', fn: () => Promise<unknown>) {
    if (
      action === 'close' &&
      !window.confirm('Close this position? Candidates will no longer be able to apply.')
    ) {
      return;
    }

    setBusy(action);
    try {
      const result = await fn();
      if (action === 'publish') toast.success(jobPublishToast(result));
      else toast.success(action === 'pause' ? 'Job paused' : 'Job closed');
      await onUpdated?.();
    } catch (err) {
      toast.error(userFacingError(err, ACTION_TEXT[action]));
    } finally {
      setBusy(null);
    }
  }

  if (status === 'CLOSED') {
    if (compact) return null;
    return <p className="text-xs font-semibold text-muted">This position is closed.</p>;
  }

  if (status === 'PENDING_REVIEW') {
    if (compact) return null;
    return (
      <p className="text-xs font-semibold text-amber-900">
        Waiting for CareerBridge approval. Candidates will see this job once it is approved.
      </p>
    );
  }

  if (compact) {
    return (
      <>
        {status === 'PUBLISHED' ? (
          <>
            <button
              type="button"
              className="ep-wire-action"
              disabled={busy !== null}
              onClick={() => void run('pause', () => pauseEmployerJob(jobId))}
            >
              {busy === 'pause' ? '…' : 'Pause'}
            </button>
            <button
              type="button"
              className="ep-wire-action ep-wire-action--danger"
              disabled={busy !== null}
              onClick={() => void run('close', () => closeEmployerJob(jobId))}
            >
              {busy === 'close' ? '…' : 'Close'}
            </button>
          </>
        ) : null}
        {status === 'PAUSED' || status === 'DRAFT' ? (
          <>
            <button
              type="button"
              className="ep-wire-action"
              disabled={busy !== null}
              onClick={() => void run('publish', () => publishEmployerJob(jobId))}
            >
              {busy === 'publish' ? '…' : status === 'PAUSED' ? 'Resume' : 'Publish'}
            </button>
            {status === 'PAUSED' ? (
              <button
                type="button"
                className="ep-wire-action ep-wire-action--danger"
                disabled={busy !== null}
                onClick={() => void run('close', () => closeEmployerJob(jobId))}
              >
                {busy === 'close' ? '…' : 'Close'}
              </button>
            ) : null}
          </>
        ) : null}
      </>
    );
  }

  return (
    <div className="ep-job-actions">
      {status === 'PUBLISHED' ? (
        <>
          <button
            type="button"
            className="ep-job-actions__btn"
            disabled={busy !== null}
            onClick={() => void run('pause', () => pauseEmployerJob(jobId))}
          >
            {busy === 'pause' ? '…' : 'Pause'}
          </button>
          <button
            type="button"
            className="ep-job-actions__btn ep-job-actions__btn--danger"
            disabled={busy !== null}
            onClick={() => void run('close', () => closeEmployerJob(jobId))}
          >
            {busy === 'close' ? '…' : 'Close'}
          </button>
        </>
      ) : null}
      {status === 'PAUSED' || status === 'DRAFT' ? (
        <>
          <button
            type="button"
            className="ep-job-actions__btn ep-job-actions__btn--primary"
            disabled={busy !== null}
            onClick={() => void run('publish', () => publishEmployerJob(jobId))}
          >
            {busy === 'publish' ? '…' : status === 'PAUSED' ? 'Resume' : 'Publish'}
          </button>
          {status === 'PAUSED' ? (
            <button
              type="button"
              className="ep-job-actions__btn ep-job-actions__btn--danger"
              disabled={busy !== null}
              onClick={() => void run('close', () => closeEmployerJob(jobId))}
            >
              {busy === 'close' ? '…' : 'Close'}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
