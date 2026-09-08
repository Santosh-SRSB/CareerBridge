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
        router.replace('/srsbaadmin/dashboard');
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
          className={`w-full rounded-xl border bg-[#f8fafc] px-3.5 py-3 text-sm font-medium text-slate-800 outline-none transition focus:bg-white focus:ring-2 ${
            identifierError
              ? 'border-error focus:border-error focus:ring-error/20'
              : 'border-slate-200 focus:border-[#0284c7] focus:ring-[#0284c7]/20'
          }`}
        />
        {identifierError ? (
          <span className="mt-1 block text-[11px] font-medium text-error">{identifierError}</span>
        ) : null}
      </div>

      {/* Password Input */}
      <div>
        <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="password-input">
          Password
        </label>
        <div className="relative">
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
            className={`w-full rounded-xl border bg-[#f8fafc] px-3.5 py-3 pr-11 text-sm font-medium text-slate-800 outline-none transition focus:bg-white focus:ring-2 ${
              passwordError
                ? 'border-error focus:border-error focus:ring-error/20'
                : 'border-slate-200 focus:border-[#0284c7] focus:ring-[#0284c7]/20'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 z-10 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-800"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
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
          onClick={() =>
            router.push(
              `/login/forgot?role=${
                accountType === 'EMPLOYER' ? 'employer' : accountType === 'CANDIDATE' ? 'candidate' : 'employer'
              }`,
            )
          }
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
