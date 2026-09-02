'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { EmployerProfile } from '@careerbridge/shared';
import { personNameError } from '@careerbridge/shared';
import { getEmployerMe, updateEmployerMe } from '@/lib/api';
import { EmployerShell, EmployerShellFallback } from '@/components/EmployerPortal';
import { BrandMascot } from '@/components/BrandMascot';
import { CitySelect } from '@/components/ui/CitySelect';
import { Button } from '@/components/ui/Button';

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="cb-profile-field block" htmlFor={name}>
      <span className="cb-profile-field__label">{label}</span>
      <input
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="cb-profile-field__input"
      />
      {hint ? <span className="cb-profile-field__hint">{hint}</span> : null}
    </label>
  );
}

export default function EmployerProfilePage() {
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getEmployerMe().then(setProfile).catch(() => setError('Could not load company profile.'));
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

  if (!profile) {
    return (
      <EmployerShellFallback>
        <p className="text-sm text-muted">{error || 'Loading company profile...'}</p>
      </EmployerShellFallback>
    );
  }

  const status = profile.verificationStatus || 'PENDING';
  const statusLabel =
    status === 'VERIFIED'
      ? 'Verified'
      : status === 'PENDING'
        ? 'Pending review'
        : status === 'REJECTED'
          ? 'Needs attention'
          : 'Setup required';

  return (
    <EmployerShell profile={profile}>
      <section className="cb-employer-page cb-profile-studio space-y-4">
        <header className="cb-list-studio__hero">
          <div className="relative z-10 min-w-0">
            <p className="text-sm font-semibold text-[#eab308]">Company desk</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Company profile
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/75 sm:text-base">
              Keep your hiring brand details accurate for candidates and verification.
            </p>
            <span className="mt-4 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold text-white">
              {statusLabel}
            </span>
          </div>
          <BrandMascot pose="book" motion="float" size="md" className="relative z-10 shrink-0" />
        </header>

        <form onSubmit={onSubmit} className="cb-profile-studio__form relative z-20">
          <div className="cb-profile-studio__form-head">
            <div>
              <h2 className="text-lg font-extrabold text-primary">Brand details</h2>
              <p className="mt-1 text-sm text-muted">
                These details appear across your recruiter workspace.
              </p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-teal" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Live profile
              </span>
            </div>
          </div>

          <div className="cb-profile-studio__grid">
            <Field
              label="Company name"
              name="companyName"
              value={profile.companyName}
              placeholder="Your company name"
              onChange={(companyName) => setProfile({ ...profile, companyName })}
            />
            <Field
              label="Industry"
              name="industry"
              value={profile.industry || ''}
              placeholder="e.g. Customer Service"
              onChange={(industry) => setProfile({ ...profile, industry })}
            />
            <div className="cb-profile-field cb-profile-field--select sm:col-span-2">
              <CitySelect
                label="Location"
                value={profile.city || ''}
                onChange={(city) => setProfile({ ...profile, city })}
              />
            </div>
            <Field
              label="Contact person"
              name="contactName"
              value={profile.contactName || ''}
              placeholder="Primary hiring contact"
              onChange={(contactName) => setProfile({ ...profile, contactName })}
              hint="Shown as the main point of contact for this company account."
            />
          </div>

          {error ? (
            <p className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-2xl border border-teal/25 bg-teal/10 px-4 py-3 text-sm font-semibold text-primary">
              {message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-primary/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">Changes apply immediately after you save.</p>
            <Button
              type="submit"
              loading={saving}
              loadingLabel="Saving..."
              block={false}
              className="cb-btn-shimmer !rounded-full !bg-gradient-to-r !from-[#0a2e2c] !to-[#134e4a] !px-8 !text-white"
            >
              Save profile
            </Button>
          </div>
        </form>
      </section>
    </EmployerShell>
  );
}
