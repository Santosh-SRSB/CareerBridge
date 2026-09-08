'use client';

import { useState } from 'react';
import { gstNumberError } from '@careerbridge/shared';
import { Button } from '@/components/ui/Button';
import { verifyGstin, type GstVerifyResult } from '@/lib/api';

type Props = {
  gstin: string;
  onVerifiedChange?: (verified: boolean) => void;
};

export function GstinVerifyField({ gstin, onVerifiedChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GstVerifyResult | null>(null);
  const [localError, setLocalError] = useState('');

  async function onVerify() {
    if (loading) return;
    setLocalError('');
    setResult(null);
    onVerifiedChange?.(false);

    const formatProblem = gstNumberError(gstin);
    if (formatProblem) {
      setLocalError(formatProblem);
      return;
    }

    setLoading(true);
    try {
      const data = await verifyGstin(gstin);
      setResult(data);
      onVerifiedChange?.(Boolean(data.verified));
    } catch (err) {
      setResult({
        success: false,
        verified: false,
        status: 'UNKNOWN',
        message:
          err instanceof Error
            ? err.message
            : 'Unable to verify GSTIN right now. Please try again.',
      });
      onVerifiedChange?.(false);
    } finally {
      setLoading(false);
    }
  }

  let feedback: string | null = null;
  let feedbackClass = 'text-muted';
  if (localError) {
    feedback = localError;
    feedbackClass = 'text-error';
  } else if (result) {
    if (result.status === 'UNKNOWN' || (!result.success && !result.verified && result.status !== 'NOT_ACTIVE')) {
      feedback = '⚠️ Unable to verify GSTIN right now. Please try again.';
      feedbackClass = 'text-amber-700';
    } else if (result.verified) {
      feedback = '✅ GSTIN Verified Successfully';
      feedbackClass = 'text-teal';
    } else if (result.status === 'NOT_ACTIVE') {
      feedback = '❌ This GSTIN is not active';
      feedbackClass = 'text-error';
    } else {
      feedback = '❌ GSTIN Verification Failed';
      feedbackClass = 'text-error';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          block={false}
          loading={loading}
          loadingLabel="Verifying GSTIN..."
          disabled={loading || !gstin.trim()}
          onClick={onVerify}
        >
          Verify GSTIN
        </Button>
      </div>
      {feedback ? <p className={`text-sm font-medium ${feedbackClass}`}>{feedback}</p> : null}
    </div>
  );
}
