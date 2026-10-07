'use client';

import { FormEvent, useState } from 'react';
import { registrationPasswordError } from '@careerbridge/shared';
import { changeOwnAdminPassword } from '@/lib/api';
import { userFacingError } from '@/lib/client-errors';

const inputClass =
  'w-full border border-[#ddd] bg-white px-3 py-2 text-sm outline-none focus:border-[#555]';

export function AdminChangePasswordForm({ email }: { email?: string | null }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    const policyError = registrationPasswordError(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await changeOwnAdminPassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOk('Password changed. Use your new password the next time you sign in.');
    } catch (err) {
      setError(userFacingError(err, 'change your password'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl border border-[#ddd] bg-white" data-testid="admin-change-password">
      <div className="bg-[#3d4f63] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
        Change password
      </div>
      <p className="border-b border-[#eee] bg-[#fafafa] px-4 py-2 text-xs text-[#777]">
        Changes the password you use to sign in to the admin portal
        {email ? (
          <>
            {' '}
            as <span className="font-semibold text-[#444]">{email}</span>
          </>
        ) : null}
        . At least 8 characters with an uppercase letter, a number, and a special character.
      </p>
      <form onSubmit={onSubmit} className="space-y-3 p-4" noValidate>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-[#444]">Current password</span>
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-[#444]">New password</span>
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-[#444]">Confirm new password</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>
        {(error || ok) && (
          <p
            role={error ? 'alert' : 'status'}
            className={`px-3 py-2 text-sm font-semibold ${
              error ? 'border border-rose-200 bg-rose-50 text-rose-800' : 'border border-teal-200 bg-teal-50 text-teal-900'
            }`}
          >
            {error || ok}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="bg-[#3d4f63] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Changing…' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
