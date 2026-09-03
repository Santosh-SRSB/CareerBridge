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

export function PasswordLoginForm({ accountType }: { accountType: LoginAccountType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Touched state
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
      if (accountType === 'SUPER_ADMIN' || accountType === 'ADMIN') {
        router.replace('/admin');
        return;
      }
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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {/* Email Input */}
      <div>
        <label className="mb-1.5 block text-xs font-bold text-primary" htmlFor="email-input">
          Email address
        </label>
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-3.5 z-10 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </span>
          <input
            id="email-input"
            name="identifier"
            type="email"
            required
            autoComplete="username"
            placeholder={
              accountType === 'SUPER_ADMIN'
                ? 'superadmin@careerbridge.local'
                : accountType === 'ADMIN'
                  ? 'admin@company.com'
                  : accountType === 'EMPLOYER'
                    ? 'you@company.com'
                    : 'Enter your email'
            }
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (!touched.identifier) markTouched('identifier');
            }}
            onBlur={() => markTouched('identifier')}
            style={{ paddingLeft: '2.6rem', paddingRight: '0.875rem' }}
            className={`w-full rounded-xl border bg-[#f8fafc] !pl-11 pr-3.5 py-3 text-sm font-medium text-slate-800 outline-none transition focus:bg-white focus:ring-2 ${
              identifierError
                ? 'border-error focus:border-error focus:ring-error/20'
                : 'border-slate-200 focus:border-[#0284c7] focus:ring-[#0284c7]/20'
            }`}
          />
        </div>
        {identifierError ? (
          <span className="mt-1 block text-[11px] font-medium text-error">{identifierError}</span>
        ) : null}
      </div>

      {/* Password Input */}
      <div>
        <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="password-input">
          Password
        </label>
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-3.5 z-10 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </span>
          <input
            id="password-input"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (!touched.password) markTouched('password');
            }}
            onBlur={() => markTouched('password')}
            style={{ paddingLeft: '2.6rem', paddingRight: '2.6rem' }}
            className={`w-full rounded-xl border bg-[#f8fafc] !pl-11 !pr-11 py-3 text-sm font-medium text-slate-800 outline-none transition focus:bg-white focus:ring-2 ${
              passwordError
                ? 'border-error focus:border-error focus:ring-error/20'
                : 'border-slate-200 focus:border-[#0284c7] focus:ring-[#0284c7]/20'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 z-10 text-slate-400 hover:text-slate-700 transition"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {passwordError ? (
          <span className="mt-1 block text-[11px] font-medium text-error">{passwordError}</span>
        ) : null}
      </div>

      {/* Remember me row */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <label className="inline-flex items-center gap-2 cursor-pointer text-slate-500 hover:text-slate-800">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#0284c7] focus:ring-[#0284c7]"
          />
          <span>Remember me</span>
        </label>
        <button
          type="button"
          onClick={() => router.push(`/login/otp?role=${accountType.toLowerCase()}`)}
          className="text-[#0284c7] hover:underline"
        >
          Forgot your password?
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-error/20 bg-error/5 p-2.5 text-xs font-semibold text-error">
          {error}
        </div>
      ) : null}

      <Button
        type="submit"
        loading={loading}
        loadingLabel="Signing in..."
        className="w-full py-3.5 text-sm font-bold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-md hover:shadow-lg transition rounded-xl tracking-wider uppercase"
      >
        Sign In
      </Button>
    </form>
  );
}
