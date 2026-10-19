'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmployerOnboardingFrame } from '@/components/EmployerOnboardingFrame';
import { Button } from '@/components/ui/Button';
import { getEmployerMe, saveEmployerKyc, verifyGstin } from '@/lib/api';
import { kycCinPayload } from '@/lib/kyc-identifiers';
import {
  cinFormatError,
  gstinFormatError,
  normalizeBusinessIdentifier,
  panFormatError,
} from '@careerbridge/shared';

type SavedIdentifiers = { gstNumber: string; panNumber: string; cin: string };

function SavedHint({ value, keepWhenBlank = false }: { value: string; keepWhenBlank?: boolean }) {
  if (!value) return null;
  return (
    <em className="ep-kyc__saved" data-testid="kyc-saved-identifier">
      Saved: {value}.{' '}
      {keepWhenBlank
        ? 'Leave blank to keep it, or enter a new number to replace it.'
        : 'Enter the full number again to keep or change it.'}
    </em>
  );
}

export default function EmployerKycPage() {
  const router = useRouter();
  /** Masked values from the server; the full identifiers are never sent back to the browser. */
  const [saved, setSaved] = useState<SavedIdentifiers>({ gstNumber: '', panNumber: '', cin: '' });
  const [gstNumber, setGstNumber] = useState('');
  const [trademark, setTrademark] = useState('');
  const [cin, setCin] = useState('');
  const [removeSavedCin, setRemoveSavedCin] = useState(false);
  const [website, setWebsite] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [gstVerified, setGstVerified] = useState(false);
  const [gstStatus, setGstStatus] = useState<'ACTIVE' | 'NOT_ACTIVE' | 'UNKNOWN' | ''>('');
  const [gstMock, setGstMock] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getEmployerMe()
      .then((profile) => {
        // Allow KYC_COMPLETE so step-2 "Back" can reopen GST/tax editing.
        if (profile.verificationStatus === 'PENDING' || profile.verificationStatus === 'VERIFIED') {
          router.replace('/employer');
          return;
        }
        setSaved({
          gstNumber: profile.gstNumber || '',
          panNumber: profile.panNumber || '',
          cin: profile.cin || '',
        });
        setWebsite(profile.website?.replace(/^https?:\/\//, '') || '');
        setReady(true);
      })
      .catch(() => router.replace('/login?role=employer'));
  }, [router]);

  async function onVerifyGst() {
    setError('');
    setGstVerified(false);
    setGstStatus('');
    setTrademark('');
    const gstin = normalizeBusinessIdentifier(gstNumber);
    const formatError = gstinFormatError(gstin);
    if (formatError) {
      setError(formatError);
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyGstin(gstin);
      const mark = (result.trademark || result.tradeName || '').trim();
      setGstStatus(result.status);
      setGstMock(Boolean(result.mock));
      if (result.verified && result.status === 'ACTIVE') {
        setGstVerified(true);
        setTrademark(mark);
        if (result.mock) {
          setError(result.message || 'Test mode: this is a mock GST check, not a live GST lookup.');
        } else if (!mark) {
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
    if (![gstNumber, trademark, website, panNumber].every((value) => value.trim().length > 0)) {
      setError('GSTIN, trademark, PAN, and website are required. CIN is optional.');
      return;
    }
    const gstin = normalizeBusinessIdentifier(gstNumber);
    const pan = normalizeBusinessIdentifier(panNumber);
    const cinValue = normalizeBusinessIdentifier(cin);
    const formatError = gstinFormatError(gstin) || panFormatError(pan) || cinFormatError(cinValue);
    if (formatError) {
      setError(formatError);
      return;
    }

    setLoading(true);
    try {
      const result = await verifyGstin(gstin);
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
        gstNumber: gstin,
        ...kycCinPayload(cinValue, removeSavedCin && Boolean(saved.cin)),
        website: website.trim(),
        panNumber: pan,
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
    <span className="ep-kyc__status ep-kyc__status--ok">{gstMock ? 'Test mode (mock)' : 'Verified'}</span>
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
      backHref="/employer/welcome"
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
          <SavedHint value={saved.gstNumber} />
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
            <span>CIN <em className="ep-kyc__optional">(optional)</em></span>
            <input
              name="cin"
              autoComplete="off"
              placeholder="U72900MH2015PTC123456"
              maxLength={25}
              value={cin}
              onChange={(event) => setCin(event.target.value.toUpperCase())}
              className="ep-kyc__input"
            />
            <em>Corporate identification number</em>
            <SavedHint value={saved.cin} keepWhenBlank />
          </label>
          <label className="ep-kyc__field">
            <span>PAN</span>
            <input
              name="panNumber"
              required
              autoComplete="off"
              placeholder="ABCPE1234F"
              maxLength={14}
              value={panNumber}
              onChange={(event) => setPanNumber(event.target.value.toUpperCase())}
              className="ep-kyc__input"
            />
            <em>Permanent account number (required)</em>
            <SavedHint value={saved.panNumber} />
          </label>
        </div>

        {saved.cin ? (
          <label className="ep-kyc__remove">
            <input
              type="checkbox"
              name="removeSavedCin"
              checked={removeSavedCin}
              disabled={Boolean(cin.trim())}
              onChange={(event) => setRemoveSavedCin(event.target.checked)}
            />
            <span>Remove the saved CIN</span>
          </label>
        ) : null}

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

        <div className="ep-kyc__actions">
          <Link href="/employer/welcome" className="ep-kyc__back">
            ← Back
          </Link>
          <Button type="submit" loading={loading} loadingLabel="Saving..." className="ep-kyc__cta">
            Save and continue
          </Button>
        </div>
      </form>
    </EmployerOnboardingFrame>
  );
}
