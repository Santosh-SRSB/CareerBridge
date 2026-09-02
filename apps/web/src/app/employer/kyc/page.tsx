'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  cinError,
  companyWebsiteError,
  gstNumberError,
  panNumberError,
} from '@careerbridge/shared';
import { EmployerOnboardingFrame } from '@/components/EmployerOnboardingFrame';
import { GstinVerifyField } from '@/components/GstinVerifyField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getEmployerMe, saveEmployerKyc } from '@/lib/api';

export default function EmployerKycPage() {
  const router = useRouter();
  const [gstNumber, setGstNumber] = useState('');
  const [cin, setCin] = useState('');
  const [website, setWebsite] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [gstVerified, setGstVerified] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getEmployerMe()
      .then((profile) => {
        if (profile.verificationStatus === 'PENDING' || profile.verificationStatus === 'VERIFIED') {
          router.replace('/employer');
          return;
        }
        if (profile.verificationStatus === 'KYC_COMPLETE') {
          router.replace('/employer/verify');
          return;
        }
        setGstNumber(profile.gstNumber || '');
        setCin(profile.cin || '');
        setWebsite(profile.website?.replace(/^https?:\/\//, '') || '');
        setPanNumber(profile.panNumber || '');
        setReady(true);
      })
      .catch(() => router.replace('/login?role=employer'));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const problem =
      gstNumberError(gstNumber) ||
      cinError(cin) ||
      companyWebsiteError(website) ||
      panNumberError(panNumber);
    if (problem) {
      setError(problem);
      return;
    }
    if (!gstVerified) {
      setError('Please verify your GSTIN before continuing.');
      return;
    }
    setLoading(true);
    try {
      await saveEmployerKyc({
        gstNumber: gstNumber.trim().toUpperCase(),
        cin: cin.trim().toUpperCase(),
        website: website.trim(),
        panNumber: panNumber.trim().toUpperCase(),
      });
      router.push('/employer/verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save KYC details.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return <main className="p-8 text-muted">Loading company KYC...</main>;
  }

  return (
    <EmployerOnboardingFrame
      step={1}
      title="Company KYC Details"
      subtitle="Provide official registration details for verification."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          label="GSTIN"
          name="gstNumber"
          required
          autoComplete="off"
          placeholder="29ABCDE1234F1Z5"
          value={gstNumber}
          onChange={(event) => {
            setGstNumber(event.target.value.toUpperCase());
            setGstVerified(false);
          }}
        />
        <GstinVerifyField gstin={gstNumber} onVerifiedChange={setGstVerified} />
        <Input
          label="CIN (Corporate Identity Number)"
          name="cin"
          required
          autoComplete="off"
          placeholder="U72900MH2015PTC123456"
          value={cin}
          onChange={(event) => setCin(event.target.value.toUpperCase())}
        />
        <Input
          label="Company Website"
          name="website"
          required
          autoComplete="url"
          placeholder="www.technova.com"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
        <Input
          label="Company PAN Number"
          name="panNumber"
          required
          autoComplete="off"
          placeholder="ABCDE1234F"
          value={panNumber}
          onChange={(event) => setPanNumber(event.target.value.toUpperCase())}
        />
        <div className="rounded-md bg-primary-soft/70 px-3.5 py-3 text-sm text-muted">
          These details are cross-checked against government &amp; registry records before your
          account is approved.
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" variant="tertiary" loading={loading} loadingLabel="Saving...">
          Save &amp; Continue
        </Button>
      </form>
    </EmployerOnboardingFrame>
  );
}
