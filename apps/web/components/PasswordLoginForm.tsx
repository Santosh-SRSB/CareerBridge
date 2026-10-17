'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { loginWithPassword } from '@/lib/api';
import { postAuthPath } from '@/lib/phone';
import type { AccountKind } from '@careerbridge/shared';

export function PasswordLoginForm({ accountType }: { accountType: AccountKind }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!identifier.trim()) {
      setError('Enter your mobile number or email.');
      return;
    }
    if (password.length < 8) {
      setError('Enter your password.');
      return;
    }
    setLoading(true);
    try {
      const session = await loginWithPassword(identifier.trim(), password, accountType);
      router.replace(postAuthPath(session.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect mobile number, email, or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        label="Mobile number or email"
        name="identifier"
        required
        autoComplete="username"
        placeholder="9876543210 or you@example.com"
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <Button type="submit" loading={loading} loadingLabel="Signing in...">
        Sign In
      </Button>
    </form>
  );
}
