'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { yearError, type CandidateCertification } from '@careerbridge/shared';
import {
  PassportFrame,
  PassportLoading,
  PassportRecord,
  WizardActions,
  passportPrimaryButtonClass,
  passportSecondaryButtonClass,
} from '@/components/PassportFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { addCertification, getCandidateMe, removeCertification } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';

export default function PassportCertificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CandidateCertification[]>([]);
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [year, setYear] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => setItems(profile.certifications || []))
      .finally(() => setReady(true));
  }, [router]);

  function resetForm() {
    setName('');
    setIssuer('');
    setYear('');
    setCredentialId('');
    setUrl('');
  }

  async function saveCurrent() {
    if (name.trim().length < 2) {
      setError('Enter the certificate name.');
      return null;
    }
    const invalidYear = yearError(year);
    if (invalidYear) {
      setError(invalidYear);
      return null;
    }
    const trimmedUrl = url.trim();
    if (trimmedUrl) {
      try {
        const withProto = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
        // eslint-disable-next-line no-new
        new URL(withProto);
      } catch {
        setError('Enter a valid certificate URL, or leave it blank.');
        return null;
      }
    }
    const profile = await addCertification({
      name: name.trim(),
      issuer: issuer.trim() || undefined,
      year: year ? Number(year) : undefined,
      credentialId: credentialId.trim() || undefined,
      url: trimmedUrl || undefined,
    });
    setItems(profile.certifications);
    resetForm();
    return profile.certifications;
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await saveCurrent();
    } catch {
      setError('We could not save that certificate right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onContinue() {
    setError('');
    setLoading(true);
    try {
      if (name.trim()) {
        const saved = await saveCurrent();
        if (!saved) {
          setLoading(false);
          return;
        }
      }
      await goToNextPassportStep(router, 'certifications');
    } catch {
      setError('We could not save that certificate right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <PassportLoading />;

  return (
    <PassportFrame
      title="Certifications"
      subtitle="Add certificates, courses, or licenses that help you stand out."
      step="certifications"
    >
      <form onSubmit={onAdd} className="space-y-4">
        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <PassportRecord
                key={item.id}
                title={item.name}
                subtitle={[item.issuer, item.year, item.credentialId].filter(Boolean).join(' · ') || 'Saved'}
                onRemove={() => void removeCertification(item.id).then((profile) => setItems(profile.certifications))}
              />
            ))}
          </div>
        ) : null}

        <Input
          label="Certificate name"
          name="certificateName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="MS Excel, Retail operations, First aid"
        />
        <Input
          label="Issued by"
          name="issuer"
          value={issuer}
          onChange={(event) => setIssuer(event.target.value)}
          placeholder="College, company, or platform"
        />
        <Input
          label="Year"
          name="year"
          inputMode="numeric"
          value={year}
          onChange={(event) => setYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="2025"
        />
        <Input
          label="Certificate ID"
          name="credentialId"
          value={credentialId}
          onChange={(event) => setCredentialId(event.target.value)}
          placeholder="Optional ID or license number"
        />
        <Input
          label="Certificate URL"
          name="certificateUrl"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Optional — https://…"
        />
        {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
        <WizardActions>
          <Button
            type="submit"
            size="md"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            variant="outline"
            className={passportSecondaryButtonClass}
          >
            Add certificate
          </Button>
          <Button
            type="button"
            size="md"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={passportPrimaryButtonClass}
            onClick={() => void onContinue()}
          >
            {items.length || name.trim() ? 'Save and continue' : 'Skip for now'}
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
