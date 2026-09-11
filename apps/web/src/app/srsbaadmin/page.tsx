'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { loginAdminPortal } from '@/lib/api';
import { clearSession, getStoredUser, isPlatformRole } from '@/lib/session';
import { roleLabel } from '@/lib/admin-portal';
import { validateEmailAddress } from '@/lib/validation';

export default function SrsbAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<{ role: string; email?: string | null } | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (user && isPlatformRole(user.role)) {
      setExisting({ role: user.role, email: user.email });
    } else {
      setExisting(null);
    }
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const emailProblem = validateEmailAddress(email.trim(), true);
    if (emailProblem) {
      setError(emailProblem);
      return;
    }
    if (password.length < 8) {
      setError('Enter your admin password.');
      return;
    }
    setLoading(true);
    try {
      // Always drop any previous staff session so Admin ≠ Operator mix-ups cannot stick.
      clearSession();
      const session = await loginAdminPortal(email.trim().toLowerCase(), password);
      if (!isPlatformRole(session.user.role)) {
        setError('This account is not authorized for the admin portal.');
        return;
      }
      router.replace('/srsbaadmin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0b1f2a] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(13,148,136,0.35), transparent 45%), radial-gradient(circle at 80% 10%, rgba(2,132,199,0.28), transparent 40%), linear-gradient(160deg, #0b1f2a, #102a37 55%, #0b1f2a)',
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-7 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <span className="rounded-full bg-[#0b1f2a] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Staff Login
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-[#0b1f2a]">SRSB Admin Portal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Super Admin, Admin, and Operator — each login uses its own email. Sign out before switching
          accounts.
        </p>

        {existing ? (
          <div className="mt-5 space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-sm text-slate-700">
              Already signed in as{' '}
              <span className="font-bold text-[#0b1f2a]">{roleLabel(existing.role)}</span>
              {existing.email ? (
                <span className="block text-xs text-slate-500">{existing.email}</span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-[#0d9488] hover:bg-[#0f766e]"
                onClick={() => router.replace('/srsbaadmin/dashboard')}
              >
                Continue
              </Button>
              <Button
                type="button"
                className="bg-slate-700 hover:bg-slate-800"
                onClick={() => {
                  clearSession();
                  setExisting(null);
                  setEmail('');
                  setPassword('');
                  setError('');
                }}
              >
                Use different account
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Staff email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="ops@careerbridge.local"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error ? (
              <p className="rounded-xl border border-error/20 bg-error/5 p-2.5 text-xs font-semibold text-error">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              loading={loading}
              loadingLabel="Signing in…"
              className="w-full bg-[#0d9488] hover:bg-[#0f766e]"
            >
              Sign in
            </Button>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Operator: <code>ops@careerbridge.local</code> / <code>Operator@12345</code>
              <br />
              Admin: <code>admin@careerbridge.local</code> / <code>Admin@12345</code>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
