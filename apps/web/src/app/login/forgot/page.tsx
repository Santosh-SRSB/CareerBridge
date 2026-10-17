'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthField, authFieldDescribedBy } from '@/components/auth/AuthField';
import { EyeIcon, LockIcon, MailIcon } from '@/components/auth/AuthIcons';
import { AuthRoleSwitch } from '@/components/auth/AuthRoleSwitch';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { OtpInput } from '@/components/OtpInput';
import { parseAccountKind } from '@/components/RoleToggle';
import { Button } from '@/components/ui/Button';
import { authErrorMessage } from '@/lib/auth-errors';
import { requestOtp } from '@/lib/api';
import { submitPasswordReset } from '@/lib/password-reset';
import { validateEmailAddress } from '@/lib/validation';
import {
  REGISTRATION_PASSWORD_HINT,
  registrationPasswordError,
  type AccountKind,
  type LoginAccountType,
} from '@careerbridge/shared';

type ErrorField = 'email' | 'otp' | 'password' | 'confirm' | null;

const ERROR_ID = 'forgot-error';

function ForgotPasswordBody() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<AccountKind>(() => parseAccountKind(params.get('role')));
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [requestId, setRequestId] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const roleSlug = role.toLowerCase();
  const signInHref = `/login?role=${roleSlug}`;
  const registerHref = `/register?role=${roleSlug}`;

  function fail(text: string, field: ErrorField = null) {
    setError(text);
    setErrorField(field);
  }

  function clearFeedback() {
    setError('');
    setErrorField(null);
    setMessage('');
  }

  function selectRole(next: LoginAccountType) {
    setRole(next);
    setStep('request');
    setRequestId('');
    setOtp('');
    clearFeedback();
    router.replace(`/login/forgot?role=${next.toLowerCase()}`, { scroll: false });
  }

  async function sendCode() {
    clearFeedback();
    const emailProblem = validateEmailAddress(email.trim(), true);
    if (emailProblem) {
      setStep('request');
      fail(emailProblem, 'email');
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp({
        channel: 'EMAIL',
        purpose: 'RESET_PASSWORD',
        email: email.trim().toLowerCase(),
        accountType: role,
      });
      setRequestId(result.requestId);
      setOtp('');
      setStep('reset');
      setMessage(
        result.devOtp
          ? `Code sent. Dev OTP: ${result.devOtp}`
          : 'We sent a 6-digit code to your email.',
      );
    } catch (err) {
      fail(authErrorMessage(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  function onRequestCode(event: FormEvent) {
    event.preventDefault();
    void sendCode();
  }

  async function onReset(event: FormEvent) {
    event.preventDefault();
    clearFeedback();
    if (otp.trim().length !== 6) {
      fail('Enter the 6-digit OTP from your email.', 'otp');
      return;
    }
    const passwordProblem = registrationPasswordError(password);
    if (passwordProblem) {
      fail(passwordProblem, 'password');
      return;
    }
    if (password !== confirm) {
      fail('Passwords do not match.', 'confirm');
      return;
    }
    setLoading(true);
    try {
      router.replace(await submitPasswordReset({ requestId, otp: otp.trim(), accountType: role, password }));
    } catch (err) {
      fail(authErrorMessage(err, 'reset'));
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setStep('request');
    setOtp('');
    setPassword('');
    setConfirm('');
    clearFeedback();
  }

  const describedBy = (field: Exclude<ErrorField, null>, hint?: string) =>
    error && errorField === field ? ERROR_ID : authFieldDescribedBy(`forgot-${field}`, undefined, hint);

  const alert = error ? (
    <div id={ERROR_ID} className="cb-auth-alert" role="alert">
      {error}
    </div>
  ) : null;

  return (
    <AuthScreen variant="forgot" role={role === 'EMPLOYER' ? 'employer' : 'candidate'} switchHref={signInHref}>
      <h1 className="au-title">Forgot password</h1>
      <p className="au-sub">
        {step === 'request'
          ? 'Enter your email to continue.'
          : 'Enter the OTP, then set and verify your new password.'}
      </p>
      <AuthRoleSwitch value={role} onChange={selectRole} label="Reset password for" />

      {step === 'request' ? (
        <form onSubmit={onRequestCode} className="cb-auth-form-stack" noValidate>
          <AuthField id="forgot-email" label={role === 'EMPLOYER' ? 'Work email' : 'Email'} icon={<MailIcon />}>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={role === 'EMPLOYER' ? 'you@company.com' : 'you@email.com'}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={errorField === 'email' || undefined}
              aria-describedby={describedBy('email')}
              className="cb-auth-field__input"
            />
          </AuthField>
          {alert}
          <Button type="submit" loading={loading} loadingLabel="Sending…" className="w-full">
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={onReset} className="cb-auth-form-stack" noValidate>
          {message ? (
            <p className="au-status" role="status">
              {message}
            </p>
          ) : null}
          <div className="cb-auth-field">
            <span id="forgot-otp-label" className="cb-auth-field__label">
              OTP
            </span>
            <OtpInput
              value={otp}
              onChange={setOtp}
              disabled={loading}
              invalid={errorField === 'otp'}
              labelledBy="forgot-otp-label"
              describedBy={describedBy('otp')}
            />
          </div>
          <AuthField
            id="forgot-password"
            label="New password"
            icon={<LockIcon />}
            hint={REGISTRATION_PASSWORD_HINT}
            controlClassName={errorField === 'password' ? 'is-error' : ''}
          >
            <input
              id="forgot-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={errorField === 'password' || undefined}
              aria-describedby={describedBy('password', REGISTRATION_PASSWORD_HINT)}
              className="cb-auth-field__input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="cb-auth-field__action"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPassword} />
            </button>
          </AuthField>
          <AuthField
            id="forgot-confirm"
            label="Confirm password"
            icon={<LockIcon />}
            controlClassName={errorField === 'confirm' ? 'is-error' : ''}
          >
            <input
              id="forgot-confirm"
              name="confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={errorField === 'confirm' || undefined}
              aria-describedby={describedBy('confirm')}
              className="cb-auth-field__input"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="cb-auth-field__action"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showConfirm} />
            </button>
          </AuthField>
          {alert}
          <Button type="submit" loading={loading} loadingLabel="Resetting…" className="w-full">
            Reset
          </Button>
          <div className="au-alt">
            <button type="button" className="au-link" disabled={loading} onClick={() => void sendCode()}>
              Send a new code
            </button>
            <button type="button" className="au-link" disabled={loading} onClick={changeEmail}>
              Use a different email
            </button>
          </div>
        </form>
      )}

      <p className="au-signup">
        <Link href={signInHref}>← Back to sign in</Link>
      </p>
      <p className="au-signup">
        Don&apos;t have an account? <Link href={registerHref}>Sign up</Link>
      </p>
    </AuthScreen>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordBody />
    </Suspense>
  );
}
