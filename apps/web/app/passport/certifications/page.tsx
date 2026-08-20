'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { yearError, type CandidateCertification } from '@careerbridge/shared';
import { PassportFrame, WizardActions } from '@/components/PassportFrame';
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
    const profile = await addCertification({
      name: name.trim(),
      issuer: issuer.trim() || undefined,
      year: year ? Number(year) : undefined,
      credentialId: credentialId.trim() || undefined,
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

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  return (
    <PassportFrame
      title="Certifications"
      subtitle="Add certificates, courses, or licenses that help you stand out."
      step="certifications"
    >
      <form onSubmit={onAdd} className="cb-passport-panel space-y-4 p-6 sm:p-7">
        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="cb-wizard-record">
                <div>
                  <p className="text-sm font-semibold text-primary">{item.name}</p>
                  <p className="text-xs text-muted">
                    {[item.issuer, item.year, item.credentialId].filter(Boolean).join(' · ') || 'Saved'}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-error"
                  onClick={async () => setItems((await removeCertification(item.id)).certifications)}
                >
                  Remove
                </button>
              </div>
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
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <WizardActions>
          <Button
            type="submit"
            size="md"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            variant="secondary"
            className="cb-wizard-secondary"
          >
            Add certificate
          </Button>
          <Button type="button" size="md" block={false} loading={loading} loadingLabel="Saving..." onClick={() => void onContinue()}>
            {items.length || name.trim() ? 'Save and continue' : 'Skip for now'}
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
