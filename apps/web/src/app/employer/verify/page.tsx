'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { designationError, emailError } from '@careerbridge/shared';
import { EmployerOnboardingFrame } from '@/components/EmployerOnboardingFrame';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getEmployerMe, submitEmployerVerification } from '@/lib/api';

export default function EmployerVerifyPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getEmployerMe()
      .then((profile) => {
        if (profile.verificationStatus === 'UNVERIFIED') {
          router.replace('/employer/kyc');
          return;
        }
        if (profile.verificationStatus === 'PENDING' || profile.verificationStatus === 'VERIFIED') {
          router.replace('/employer');
          return;
        }
        setCompanyName(profile.companyName || '');
        setWorkEmail(profile.workEmail || '');
        setDesignation(profile.designation || '');
        setReady(true);
      })
      .catch(() => router.replace('/login?role=employer'));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const name = companyName.trim().replace(/\s+/g, ' ');
    const problem =
      (name.length < 2 ? 'Enter the company name.' : null) ||
      emailError(workEmail) ||
      designationError(designation);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    try {
      await submitEmployerVerification({
        companyName: name,
        workEmail: workEmail.trim().toLowerCase(),
        designation: designation.trim().replace(/\s+/g, ' '),
      });
      router.replace('/employer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit verification.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return <main className="p-8 text-muted">Loading company verification...</main>;
  }

  return (
    <EmployerOnboardingFrame
      step={2}
      title="Verify Company Affiliation"
      subtitle="Confirm that you are authorized to recruit for this company."
      backHref="/employer/kyc"
    >
      <form onSubmit={onSubmit} className="ep-kyc">
        <Input
          label="Company Name"
          name="companyName"
          required
          autoComplete="organization"
          placeholder="TechNova Solutions Pvt. Ltd."
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
        />
        <Input
          label="Official Work Email"
          name="workEmail"
          type="email"
          required
          autoComplete="email"
          placeholder="ananya@technova.com"
          value={workEmail}
          onChange={(event) => setWorkEmail(event.target.value)}
        />
        <Input
          label="Designation"
          name="designation"
          required
          autoComplete="organization-title"
          placeholder="Talent Acquisition Manager"
          value={designation}
          onChange={(event) => setDesignation(event.target.value)}
        />
        <p className="ep-kyc__hint">
          May use company domain, email OTP, documents, or admin approval.
        </p>
        {error ? <p className="ep-kyc__error">{error}</p> : null}
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          loadingLabel="Submitting..."
          className="ep-kyc__cta"
        >
          Submit Verification
        </Button>
      </form>
    </EmployerOnboardingFrame>
  );
}
