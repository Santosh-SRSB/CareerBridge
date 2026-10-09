'use client';

import { FormEvent, useState } from 'react';
import { registrationPasswordError } from '@careerbridge/shared';
import { changeOwnAdminPassword } from '@/lib/api';
import { userFacingError } from '@/lib/client-errors';

const inputClass = 'sa-input w-full px-3 py-2 text-sm';

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
    <div className="sa-card max-w-xl overflow-hidden" data-testid="admin-change-password">
      <div className="sa-panel-h px-4 py-3 text-sm font-bold uppercase tracking-wide">Change password</div>
      <p className="sa-note sa-muted px-4 py-2 text-xs">
        Changes the password you use to sign in to the admin portal
        {email ? (
          <>
            {' '}
            as <span className="sa-ink font-semibold">{email}</span>
          </>
        ) : null}
        . At least 8 characters with an uppercase letter, a number, and a special character.
      </p>
      <form onSubmit={onSubmit} className="space-y-3 p-4" noValidate>
        <label className="block">
          <span className="sa-ink mb-1 block text-[11px] font-bold">Current password</span>
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
          <span className="sa-ink mb-1 block text-[11px] font-bold">New password</span>
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
          <span className="sa-ink mb-1 block text-[11px] font-bold">Confirm new password</span>
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
            className={`sa-notice px-3 py-2 text-sm font-semibold ${error ? 'sa-notice--error' : ''}`}
          >
            {error || ok}
          </p>
        )}
        <button type="submit" disabled={busy} className="sa-btn">
          {busy ? 'Changing…' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
