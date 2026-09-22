'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { loginWithPassword } from '@/lib/api';
import { postAuthPath } from '@/lib/phone';
import { validateEmailAddress } from '@/lib/validation';
import type { LoginAccountType } from '@careerbridge/shared';

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

export function PasswordLoginForm({ accountType }: { accountType: LoginAccountType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [touched, setTouched] = useState({
    identifier: false,
    password: false,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const identifierError = (() => {
    if (!touched.identifier) return '';
    return validateEmailAddress(identifier, true) || '';
  })();

  const passwordError = (() => {
    if (!touched.password) return '';
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    return '';
  })();

  function markTouched(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    setTouched({ identifier: true, password: true });

    if (!identifier.trim()) {
      setError('Enter your email.');
      return;
    }
    const emailProblem = validateEmailAddress(identifier.trim(), true);
    if (emailProblem) {
      setError(emailProblem);
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const session = await loginWithPassword(identifier.trim(), password, accountType);
      const next = safeNextPath(searchParams.get('next'));
      const onboarding = postAuthPath(session.user);
      const destination =
        accountType === 'EMPLOYER' && next?.startsWith('/employer')
          ? next
          : onboarding;
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="cb-auth-form-stack" noValidate>
      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="email-input">
          Email
        </label>
        <div className={`cb-auth-field__control ${identifierError ? 'is-error' : ''}`}>
          <span className="cb-auth-field__icon">
            <MailIcon />
          </span>
          <input
            id="email-input"
            name="identifier"
            type="email"
            required
            autoComplete="username"
            placeholder="Username"
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (!touched.identifier) markTouched('identifier');
            }}
            onBlur={() => markTouched('identifier')}
            className="cb-auth-field__input"
          />
        </div>
        {identifierError ? <span className="cb-auth-field__error">{identifierError}</span> : null}
      </div>

      <div className="cb-auth-field">
        <label className="cb-auth-field__label" htmlFor="password-input">
          Password
        </label>
        <div className={`cb-auth-field__control ${passwordError ? 'is-error' : ''}`}>
          <span className="cb-auth-field__icon">
            <LockIcon />
          </span>
          <input
            id="password-input"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (!touched.password) markTouched('password');
            }}
            onBlur={() => markTouched('password')}
            className="cb-auth-field__input"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="cb-auth-field__action"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {passwordError ? <span className="cb-auth-field__error">{passwordError}</span> : null}
      </div>

      <div className="cb-auth-meta">
        <label className="cb-auth-meta__check">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span>Remember</span>
        </label>
        <button
          type="button"
          onClick={() =>
            router.push(
              `/login/forgot?role=${
                accountType === 'EMPLOYER' ? 'employer' : accountType === 'CANDIDATE' ? 'candidate' : 'employer'
              }`,
            )
          }
          className="cb-auth-meta__link"
        >
          Forgot password?
        </button>
      </div>

      {error ? <div className="cb-auth-alert">{error}</div> : null}

      <Button type="submit" loading={loading} loadingLabel="Signing in..." className="w-full">
        LOGIN
      </Button>
    </form>
  );
}
