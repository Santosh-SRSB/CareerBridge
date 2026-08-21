'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { OtpInput } from '@/components/OtpInput';
import { Button } from '@/components/ui/Button';
import { clearOtpFlow, getOtpFlow, saveOtpFlow } from '@/lib/otp-flow';
import { clearPendingPassword, getPendingPassword } from '@/lib/pending-password';
import { requestOtp, verifyOtp } from '@/lib/api';
import { authErrorMessage } from '@/lib/auth-errors';
import { formatPhoneDisplay, postAuthPath } from '@/lib/phone';
import {
  clearFirebaseOtp,
  confirmFirebaseOtp,
  isDevOtpEnabled,
  isFirebaseConfigured,
  sendFirebaseOtp,
} from '@/lib/firebase';
import type { OtpChannel } from '@careerbridge/shared';

export default function VerifyOtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('MOBILE');
  const [backHref, setBackHref] = useState('/login');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const flow = getOtpFlow();
    if (!flow) {
      router.replace('/login');
      return;
    }
    setPhone(flow.phone);
    setEmail(flow.email || '');
    setChannel(flow.channel || 'MOBILE');
    setBackHref(
      flow.registration?.accountType === 'EMPLOYER'
        ? '/register?role=employer'
        : flow.purpose === 'REGISTER'
          ? '/register?role=candidate'
          : '/login',
    );
    setSecondsLeft(Math.max(0, Math.ceil((flow.expiresAt - Date.now()) / 1000)));
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const destination =
    channel === 'EMAIL' ? email : formatPhoneDisplay(phone);
  const changeLabel = channel === 'EMAIL' ? 'Change email' : 'Change mobile number';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const flow = getOtpFlow();
    if (!flow) return;
    if (otp.length < 6) {
      setError('Incorrect OTP. Please check the code and try again.');
      setErrorCode('INVALID_OTP');
      return;
    }
    setError('');
    setErrorCode('');
    setLoading(true);
    try {
      if (secondsLeft <= 0) {
        setError('This OTP has expired.');
        setErrorCode('OTP_EXPIRED');
        return;
      }
      const result =
        flow.channel === 'EMAIL' || isDevOtpEnabled()
          ? await verifyOtp({ requestId: flow.requestId, otp })
          : await verifyOtp({
              requestId: flow.requestId,
              idToken: await confirmFirebaseOtp(otp),
            });
      clearOtpFlow();
      clearFirebaseOtp();
      clearPendingPassword();
      if ('signInRequired' in result && result.signInRequired) {
        router.replace('/login?registered=1&role=employer');
        return;
      }
      if (!('accessToken' in result)) {
        return;
      }
      router.replace(postAuthPath(result.user));
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      setErrorCode(code);
      setError(authErrorMessage(err, 'verify'));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    const flow = getOtpFlow();
    if (!flow) return;
    setError('');
    setErrorCode('');
    setResending(true);
    try {
      const password = getPendingPassword();
      const result = await requestOtp({
        channel: flow.channel || 'MOBILE',
        purpose: flow.purpose,
        phone: flow.phone || undefined,
        email: flow.email,
        ...(flow.registration
          ? { ...flow.registration, password: password || undefined }
          : {}),
      });
      if (flow.channel !== 'EMAIL' && !isDevOtpEnabled()) {
        if (!isFirebaseConfigured()) {
          throw new Error('Firebase OTP is not configured yet.');
        }
        await sendFirebaseOtp(flow.phone);
      }
      saveOtpFlow({
        ...flow,
        requestId: result.requestId,
        expiresAt: Date.now() + result.expiresIn * 1000,
      });
      setSecondsLeft(result.expiresIn);
      setOtp('');
    } catch (err) {
      setError(authErrorMessage(err, 'request'));
    } finally {
      setResending(false);
    }
  }

  if (!ready) return null;

  const expired = secondsLeft <= 0 || errorCode === 'OTP_EXPIRED';

  return (
    <AuthShell
      title={channel === 'EMAIL' ? 'Verify your email' : 'Verify your number'}
      subtitle={`OTP sent to ${destination}`}
      backHref={backHref}
      scene="verify"
      panelTitle="Check your code"
      panelCopy="Enter the 6-digit OTP to confirm your account."
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <OtpInput value={otp} onChange={setOtp} />
        {error ? <p className="text-sm text-error">{error}</p> : null}
        {expired ? (
          <Button type="button" onClick={resend} loading={resending} loadingLabel="Sending...">
            Send New OTP
          </Button>
        ) : (
          <Button type="submit" loading={loading} loadingLabel="Verifying...">
            Verify
          </Button>
        )}
      </form>
      <div className="mt-6 space-y-3 text-center text-sm">
        <p className="text-muted">Didn&apos;t receive OTP?</p>
        <button
          type="button"
          onClick={resend}
          disabled={resending || (!expired && secondsLeft > 270)}
          className="font-semibold text-primary disabled:text-muted"
        >
          {resending ? 'Sending...' : 'Resend OTP'}
        </button>
        <p>
          <Link href={backHref} className="text-muted">
            {changeLabel}
          </Link>
        </p>
      </div>
      {isDevOtpEnabled() ? (
        <p className="mt-8 rounded-md bg-primary-soft p-3 text-sm text-primary">
          Local OTP mode is on. Use code <strong>123456</strong>.
        </p>
      ) : channel === 'EMAIL' ? (
        <p className="mt-8 rounded-md bg-accent-soft p-3 text-sm text-primary">
          Check your email inbox (and spam) for the 6-digit CareerBridge code.
        </p>
      ) : (
        <p className="mt-8 rounded-md bg-primary-soft p-3 text-sm text-primary">
          Firebase Phone OTP is on. Enter the SMS code, or the test-number code from the Firebase console.
        </p>
      )}
    </AuthShell>
  );
}
