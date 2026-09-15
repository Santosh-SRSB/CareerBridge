'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmployerOnboardingFrame } from '@/components/EmployerOnboardingFrame';
import { Button } from '@/components/ui/Button';
import { getEmployerMe, saveEmployerKyc, verifyGstin } from '@/lib/api';

export default function EmployerKycPage() {
  const router = useRouter();
  const [gstNumber, setGstNumber] = useState('');
  const [trademark, setTrademark] = useState('');
  const [cin, setCin] = useState('');
  const [website, setWebsite] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [gstVerified, setGstVerified] = useState(false);
  const [gstStatus, setGstStatus] = useState<'ACTIVE' | 'NOT_ACTIVE' | 'UNKNOWN' | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
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

  async function onVerifyGst() {
    setError('');
    setGstVerified(false);
    setGstStatus('');
    setTrademark('');
    const gstin = gstNumber.trim().toUpperCase();
    if (gstin.length !== 15) {
      setError('Enter a valid 15-character GSTIN before verifying.');
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyGstin(gstin);
      const mark = (result.trademark || result.tradeName || '').trim();
      setGstStatus(result.status);
      if (result.verified && result.status === 'ACTIVE') {
        setGstVerified(true);
        setTrademark(mark);
        if (!mark) {
          setError('GSTIN is active, but no trade name was returned. Enter the trademark manually.');
        }
      } else if (result.status === 'NOT_ACTIVE') {
        setError(result.message || 'This GSTIN is not active. Enter an active GSTIN to continue.');
        setGstVerified(false);
      } else {
        setError(result.message || 'Could not verify GSTIN. Check the number or try again.');
        setGstVerified(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GST verification failed.');
      setGstVerified(false);
    } finally {
      setVerifying(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (![gstNumber, trademark, cin, website, panNumber].every((value) => value.trim().length > 0)) {
      setError('Fill in all fields to continue.');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyGstin(gstNumber.trim().toUpperCase());
      if (!result.verified || result.status !== 'ACTIVE') {
        setError(
          result.message ||
            (result.status === 'NOT_ACTIVE'
              ? 'This GSTIN is not active.'
              : 'GSTIN could not be verified. Fix the number or try again.'),
        );
        setLoading(false);
        return;
      }
      setGstVerified(true);
      const mark = (result.trademark || result.tradeName || '').trim();
      if (mark) setTrademark(mark);
      await saveEmployerKyc({
        gstNumber: gstNumber.trim().toUpperCase(),
        cin: cin.trim().toUpperCase(),
        website: website.trim(),
        panNumber: panNumber.trim().toUpperCase(),
        trademark: (mark || trademark).trim(),
      });
      router.push('/employer/verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save KYC details.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return <main className="ep-onboard-page ep-onboard-page--loading">Loading company KYC…</main>;
  }

  const gstLabelStatus = gstVerified ? (
    <span className="ep-kyc__status ep-kyc__status--ok">Verified</span>
  ) : gstStatus === 'NOT_ACTIVE' ? (
    <span className="ep-kyc__status ep-kyc__status--bad">Not active</span>
  ) : (
    <span className="ep-kyc__status">Not verified</span>
  );

  return (
    <EmployerOnboardingFrame
      step={1}
      title="Verify your business identity"
      subtitle="Confirm your GSTIN, then your registration and tax IDs."
      sideTitle="Let's verify your GSTIN!"
    >
      <form onSubmit={onSubmit} className="ep-kyc">
        <div className="ep-kyc__gst-block">
          <div className="ep-kyc__label-row">
            <span>GSTIN</span>
            {gstLabelStatus}
          </div>
          <div className="ep-kyc__gst-row">
            <input
              name="gstNumber"
              required
              autoComplete="off"
              placeholder="29ABCDE1234F1Z5"
              value={gstNumber}
              onChange={(event) => {
                setGstNumber(event.target.value.toUpperCase());
                setGstVerified(false);
                setGstStatus('');
                setTrademark('');
              }}
              className="ep-kyc__input"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              block={false}
              loading={verifying}
              loadingLabel="…"
              className="ep-kyc__verify-btn"
              onClick={() => void onVerifyGst()}
            >
              Verify GSTIN
            </Button>
          </div>
        </div>

        <label className="ep-kyc__field">
          <span>Trademark / trade name</span>
          <input
            name="trademark"
            required
            autoComplete="organization"
            placeholder="Auto-filled after verify"
            value={trademark}
            onChange={(event) => setTrademark(event.target.value)}
            className={`ep-kyc__input${gstVerified && trademark ? ' ep-kyc__input--ok' : ''}`}
          />
        </label>

        <div className="ep-kyc__grid">
          <label className="ep-kyc__field">
            <span>CIN</span>
            <input
              name="cin"
              required
              autoComplete="off"
              placeholder="U72900MH2015PTC12345"
              value={cin}
              onChange={(event) => setCin(event.target.value.toUpperCase())}
              className="ep-kyc__input"
            />
            <em>Corporate identification number</em>
          </label>
          <label className="ep-kyc__field">
            <span>PAN</span>
            <input
              name="panNumber"
              required
              autoComplete="off"
              placeholder="ABCDE1234F"
              value={panNumber}
              onChange={(event) => setPanNumber(event.target.value.toUpperCase())}
              className="ep-kyc__input"
            />
            <em>Permanent account number</em>
          </label>
        </div>

        <label className="ep-kyc__field">
          <span>Company website</span>
          <input
            name="website"
            type="text"
            required
            autoComplete="url"
            placeholder="www.technova.com"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            className="ep-kyc__input"
          />
        </label>

        {error ? <p className="ep-kyc__error">{error}</p> : null}

        <Button type="submit" loading={loading} loadingLabel="Saving..." className="ep-kyc__cta">
          Save and continue
        </Button>
      </form>
    </EmployerOnboardingFrame>
  );
}
