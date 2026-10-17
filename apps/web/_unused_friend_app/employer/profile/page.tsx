'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { EmployerProfile } from '@careerbridge/shared';
import { personNameError } from '@careerbridge/shared';
import { getEmployerMe, updateEmployerMe } from '@/lib/api';
import { EmployerHeader, EmployerNav } from '@/components/EmployerNav';
import { Input } from '@/components/ui/Input';
import { CitySelect } from '@/components/ui/CitySelect';
import { Button } from '@/components/ui/Button';

export default function EmployerProfilePage() {
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getEmployerMe().then(setProfile);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    if (profile.companyName.trim().length < 2) {
      setError('Enter the company name.');
      setMessage('');
      return;
    }
    if ((profile.city || '').trim().length < 2) {
      setError('Select or enter the company location.');
      setMessage('');
      return;
    }
    const contactError = personNameError(profile.contactName || '', 'Enter the contact person name.');
    if (contactError) {
      setError(contactError);
      setMessage('');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await updateEmployerMe(profile);
      setProfile(updated);
      setMessage('Company profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save the company profile.');
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <main className="p-8 text-muted">Loading company profile...</main>;

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <EmployerHeader />
      <h1 className="mt-4 text-2xl font-bold text-primary">Company profile</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-md bg-surface p-5 shadow-sm">
        <Input label="Company name" name="companyName" value={profile.companyName} onChange={(event) => setProfile({ ...profile, companyName: event.target.value })} />
        <Input label="Industry" name="industry" value={profile.industry || ''} onChange={(event) => setProfile({ ...profile, industry: event.target.value })} />
        <CitySelect label="Location" value={profile.city || ''} onChange={(city) => setProfile({ ...profile, city })} />
        <Input label="Contact person" name="contactName" value={profile.contactName || ''} onChange={(event) => setProfile({ ...profile, contactName: event.target.value })} />
        {error ? <p className="text-sm text-error">{error}</p> : null}
        {message ? <p className="text-sm text-success">{message}</p> : null}
        <Button type="submit" loading={saving} loadingLabel="Saving...">Save</Button>
      </form>
      <EmployerNav />
    </main>
  );
}
