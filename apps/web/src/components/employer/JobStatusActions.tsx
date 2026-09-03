'use client';

import { useState } from 'react';
import { closeEmployerJob, pauseEmployerJob, publishEmployerJob } from '@/lib/api';
import { Button } from '@/components/ui/Button';

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
      await fn();
      await onUpdated?.();
    } finally {
      setBusy(null);
    }
  }

  if (status === 'CLOSED') {
    if (compact) return null;
    return <p className="text-xs font-semibold text-muted">This position is closed.</p>;
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
              className="ep-wire-action ep-wire-action--muted"
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
                className="ep-wire-action ep-wire-action--muted"
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
    <div className="mt-3 flex flex-wrap gap-1.5">
      {status === 'PUBLISHED' ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            block={false}
            loading={busy === 'pause'}
            loadingLabel="…"
            onClick={() => run('pause', () => pauseEmployerJob(jobId))}
          >
            Pause
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            block={false}
            loading={busy === 'close'}
            loadingLabel="…"
            onClick={() => run('close', () => closeEmployerJob(jobId))}
          >
            Close
          </Button>
        </>
      ) : null}
      {status === 'PAUSED' || status === 'DRAFT' ? (
        <>
          <Button
            type="button"
            size="sm"
            block={false}
            loading={busy === 'publish'}
            loadingLabel="…"
            onClick={() => run('publish', () => publishEmployerJob(jobId))}
          >
            {status === 'PAUSED' ? 'Resume' : 'Publish'}
          </Button>
          {status === 'PAUSED' ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              block={false}
              loading={busy === 'close'}
              loadingLabel="…"
              onClick={() => run('close', () => closeEmployerJob(jobId))}
            >
              Close
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
