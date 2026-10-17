'use client';

import { FormEvent, type MouseEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { OtpInput } from '@/components/OtpInput';
import { Button } from '@/components/ui/Button';
import { clearOtpFlow, getOtpFlow, saveOtpFlow } from '@/lib/otp-flow';
import { clearPendingPassword, getPendingPassword } from '@/lib/pending-password';
import { clearRegistrationDraft, markRegistrationDraftForChange } from '@/lib/registration-draft';
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
  const [role, setRole] = useState<'candidate' | 'employer'>('candidate');
  const [registering, setRegistering] = useState(false);
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
    setRole(flow.registration?.accountType === 'EMPLOYER' ? 'employer' : 'candidate');
    setRegistering(flow.purpose === 'REGISTER');
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
      clearRegistrationDraft();
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

  // Registration: go back to the filled-in form; the current OTP request is abandoned so the old number
  // stops being the verification target, and the next submission tells the server to expire it.
  function changeContact(event: MouseEvent<HTMLAnchorElement>) {
    const flow = getOtpFlow();
    if (!flow || flow.purpose !== 'REGISTER') return;
    event.preventDefault();
    markRegistrationDraftForChange(flow.requestId);
    clearOtpFlow();
    clearFirebaseOtp();
    router.push(`${backHref}&change=${flow.channel === 'EMAIL' ? 'email' : 'mobile'}`);
  }

  if (!ready) return null;

  const expired = secondsLeft <= 0 || errorCode === 'OTP_EXPIRED';

  return (
    <AuthScreen
      variant={registering ? 'verify' : 'login'}
      role={role}
      switchHref={`/login?role=${role}`}
      backHref={backHref}
    >
      <h1 className="au-title">{verifyTitle}</h1>
      <p className="au-sub">
        Enter the 6-digit OTP sent to <strong>{destination}</strong>
      </p>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="cb-auth-form-stack"
        aria-busy={loading || undefined}
        noValidate
      >
        <div className="cb-auth-field">
          <span id="otp-label" className="cb-auth-field__label">
            OTP
          </span>
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
            labelledBy="otp-label"
            describedBy={error ? 'otp-error' : undefined}
          />
        </div>

        <p className="au-timer" aria-live="off">
          {Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:{(secondsLeft % 60).toString().padStart(2, '0')}
        </p>

        {error ? (
          <div id="otp-error" role="alert" className="cb-auth-alert">
            {error}
          </div>
        ) : null}

        <Button type="submit" loading={loading} loadingLabel="Verifying..." disabled={expired} className="w-full">
          Verify
        </Button>
      </form>

      <div className="au-resend">
        <p>Didn&apos;t receive OTP?</p>
        <div className="au-alt">
          <button
            type="button"
            className="au-link"
            onClick={resend}
            disabled={resending || (!expired && secondsLeft > 0)}
            aria-busy={resending || undefined}
          >
            {resending ? 'Sending...' : 'Resend OTP'}
          </button>
          <Link href={backHref} onClick={changeContact} className="au-link">
            {changeLabel}
          </Link>
        </div>
      </div>
      {isDevOtpEnabled() && !isEmailChannel ? (
        <p className="au-hint">
          Local OTP mode is on. Use code <strong>123456</strong>.
        </p>
      ) : isEmailChannel ? (
        <p className="au-hint">Check your email inbox (and spam) for the 6-digit CareerBridge code.</p>
      ) : null}
    </AuthScreen>
  );
}
