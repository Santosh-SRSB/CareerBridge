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
    return <p className="text-sm font-semibold text-muted">This position is closed.</p>;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : 'mt-3'}`}>
      {status === 'PUBLISHED' ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="md"
            block={false}
            loading={busy === 'pause'}
            loadingLabel="Pausing..."
            className="!rounded-full"
            onClick={() => run('pause', () => pauseEmployerJob(jobId))}
          >
            Pause
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="md"
            block={false}
            loading={busy === 'close'}
            loadingLabel="Closing..."
            className="!rounded-full"
            onClick={() => run('close', () => closeEmployerJob(jobId))}
          >
            Close position
          </Button>
        </>
      ) : null}
      {status === 'PAUSED' || status === 'DRAFT' ? (
        <>
          <Button
            type="button"
            size="md"
            block={false}
            loading={busy === 'publish'}
            loadingLabel="Publishing..."
            className="!rounded-full"
            onClick={() => run('publish', () => publishEmployerJob(jobId))}
          >
            {status === 'PAUSED' ? 'Resume posting' : 'Publish now'}
          </Button>
          {status === 'PAUSED' ? (
            <Button
              type="button"
              variant="destructive"
              size="md"
              block={false}
              loading={busy === 'close'}
              loadingLabel="Closing..."
              className="!rounded-full"
              onClick={() => run('close', () => closeEmployerJob(jobId))}
            >
              Close position
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
