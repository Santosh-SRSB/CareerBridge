'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/AuthShell';
import { OtpInput } from '@/components/OtpInput';
import { Button } from '@/components/ui/Button';
import { clearOtpFlow, getOtpFlow, saveOtpFlow } from '@/lib/otp-flow';
import { clearPendingPassword, getPendingPassword } from '@/lib/pending-password';
import { requestOtp, verifyOtp } from '@/lib/api';
import { authErrorMessage } from '@/lib/auth-errors';
import { postAuthPath } from '@/lib/phone';
import { toast } from '@/components/ui/Toast';
import { POST_REGISTRATION_PATH } from '@/lib/onboarding-flow';
import { patchStoredUser } from '@/lib/session';
import {
  clearFirebaseOtp,
  confirmFirebaseOtp,
  hasFirebaseOtpConfirmation,
  isDevOtpEnabled,
  isFirebaseConfigured,
  sendFirebaseOtp,
} from '@/lib/firebase';
import { OTP_EXPIRED_MESSAGE, maskMobileNumber, type OtpChannel } from '@careerbridge/shared';

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
  const [expiryKey, setExpiryKey] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const autoSubmittedRef = useRef('');

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

    // Reuse an existing Firebase SMS session when possible (avoids a second slow send).
    const otpChannel = flow.channel;
    const otpPhone = flow.phone;
    let cancelled = false;
    async function ensureFirebaseSms() {
      if (otpChannel === 'EMAIL' || isDevOtpEnabled()) return;
      if (!otpPhone || hasFirebaseOtpConfirmation(otpPhone)) return;
      try {
        if (!isFirebaseConfigured()) {
          throw new Error('Firebase OTP is not configured yet.');
        }
        await sendFirebaseOtp(otpPhone);
      } catch (err) {
        if (!cancelled) {
          setError(authErrorMessage(err, 'request'));
        }
      }
    }
    void ensureFirebaseSms();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Recompute from the stored deadline on every tick so a throttled tab or clock jump still expires on time.
  // Expiry is announced once per OTP so a later resend error is not overwritten on the next tick.
  useEffect(() => {
    if (!ready) return;
    let announced = false;
    const tick = () => {
      const flow = getOtpFlow();
      if (!flow) return;
      const left = Math.max(0, Math.ceil((flow.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !announced) {
        announced = true;
        setErrorCode('OTP_EXPIRED');
        setError(OTP_EXPIRED_MESSAGE);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [ready, expiryKey]);

  const isEmailChannel = channel === 'EMAIL';
  const verifyTitle = isEmailChannel ? 'Verify your email' : 'Verify your mobile number';
  const panelCopy = isEmailChannel
    ? 'Enter the 6-digit OTP sent to your email to confirm your account.'
    : 'Enter the 6-digit OTP sent to your phone to confirm your account.';
  const destination = isEmailChannel ? email : maskMobileNumber(phone);
  const changeLabel = isEmailChannel ? 'Change email' : 'Change mobile number';

  function otpExpired(flow: { expiresAt: number }) {
    return flow.expiresAt <= Date.now();
  }

  // Auto-submit once all six digits are entered (typed or pasted).
  useEffect(() => {
    if (otp.length !== 6 || loading || autoSubmittedRef.current === otp) return;
    autoSubmittedRef.current = otp;
    formRef.current?.requestSubmit();
  }, [otp, loading]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const flow = getOtpFlow();
    if (!flow || loading) return;
    if (otpExpired(flow)) {
      setSecondsLeft(0);
      setError(OTP_EXPIRED_MESSAGE);
      setErrorCode('OTP_EXPIRED');
      return;
    }
    if (otp.length < 6) {
      setError('Enter the 6-digit OTP.');
      setErrorCode('INVALID_OTP');
      return;
    }
    setError('');
    setErrorCode('');
    setLoading(true);
    try {
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
    const password = getPendingPassword();
    // The password is held in memory only, so it is gone after a page refresh and a registration resend cannot be sent.
    if (flow.purpose === 'REGISTER' && flow.registration && !password) {
      setErrorCode('RESEND_NEEDS_DETAILS');
      setError('For your security, your password is not kept after the page is refreshed. Go back, enter your details again and we will send a new OTP.');
      return;
    }
    setError('');
    setErrorCode('');
    setResending(true);
    try {
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
      setExpiryKey((value) => value + 1);
      autoSubmittedRef.current = '';
      setOtp('');
      toast.success('A new OTP has been sent.');
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
      mode="register"
      panelTitle={verifyTitle}
      panelCopy={panelCopy}
    >
      <form ref={formRef} onSubmit={onSubmit} className="space-y-5" aria-busy={loading || undefined}>
        <OtpInput
          value={otp}
          onChange={(value) => {
            setOtp(value);
            if (errorCode === 'INVALID_OTP') {
              setError('');
              setErrorCode('');
            }
          }}
          disabled={loading || resending || expired}
          invalid={Boolean(error) && errorCode !== 'OTP_EXPIRED'}
          describedBy={error ? 'otp-error' : undefined}
        />

        <div className="text-center">
          <span className="font-mono text-base font-bold text-slate-700" aria-live="off">
            {Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:{(secondsLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>

        {error ? (
          <p id="otp-error" role="alert" className="text-center text-xs font-semibold text-error">
            {error}
          </p>
        ) : null}

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
      {isDevOtpEnabled() && !isEmailChannel ? (
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
