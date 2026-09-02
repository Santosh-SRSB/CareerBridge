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
import { POST_REGISTRATION_PATH } from '@/lib/onboarding-flow';
import { patchStoredUser } from '@/lib/session';
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

  const isEmailChannel = channel === 'EMAIL';
  const verifyTitle = isEmailChannel ? 'Verify your email' : 'Verify your mobile number';
  const panelCopy = isEmailChannel
    ? 'Enter the 6-digit OTP sent to your email to confirm your account.'
    : 'Enter the 6-digit OTP sent to your phone to confirm your account.';
  const destination = isEmailChannel ? email : formatPhoneDisplay(phone);
  const changeLabel = isEmailChannel ? 'Change email' : 'Change mobile number';

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
      const flowPurpose = flow.purpose;
      if (flowPurpose === 'REGISTER') {
        patchStoredUser({ onboardingCompleted: false });
        router.replace(POST_REGISTRATION_PATH);
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
      title={verifyTitle}
      subtitle={`OTP sent to ${destination}`}
      backHref={backHref}
      scene="verify"
      panelTitle={verifyTitle}
      panelCopy={panelCopy}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <OtpInput value={otp} onChange={setOtp} />

        <div className="text-center">
          <span className="font-mono text-base font-bold text-slate-700">
            {Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:{(secondsLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>

        {error ? <p className="text-center text-xs font-semibold text-error">{error}</p> : null}

        <Button
          type="submit"
          loading={loading}
          loadingLabel="Verifying..."
          disabled={expired}
          className="w-full py-3.5 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-md hover:shadow-lg transition rounded-xl disabled:opacity-50"
        >
          Verify
        </Button>
      </form>

      <div className="mt-5 space-y-2 text-center text-xs">
        <p className="text-slate-500 font-medium">Didn&apos;t receive OTP?</p>
        <Button
          type="button"
          variant="outline"
          onClick={resend}
          loading={resending}
          loadingLabel="Sending..."
          disabled={!expired && secondsLeft > 0}
          className="w-full rounded-xl border-slate-200 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          Resend OTP
        </Button>
        <div>
          <Link href={backHref} className="text-slate-500 hover:text-slate-800 text-xs transition">
            {changeLabel}
          </Link>
        </div>
      </div>
      {isDevOtpEnabled() ? (
        <p className="mt-8 rounded-md bg-primary-soft p-3 text-sm text-primary">
          Local OTP mode is on. Use code <strong>123456</strong>.
        </p>
      ) : isEmailChannel ? (
        <p className="mt-8 rounded-md bg-accent-soft p-3 text-sm text-primary">
          Check your email inbox (and spam) for the 6-digit CareerBridge code.
        </p>
      ) : null}
    </AuthShell>
  );
}
