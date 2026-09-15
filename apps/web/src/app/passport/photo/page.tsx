'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { photoFileError } from '@careerbridge/shared';
import {
  PassportFrame,
  PassportLoading,
  WizardActions,
  passportPrimaryButtonClass,
} from '@/components/PassportFrame';
import { Button } from '@/components/ui/Button';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { getCandidateMe, updateCandidateMe, uploadCandidatePhoto } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';
import { goToReturnTo, peekReturnTo } from '@/lib/nav-return';
import { compressImageBlob } from '@/lib/image';

const ACCEPT = 'image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png';

function notifyPhotoUpdated(photoUrl: string | null) {
  patchStoredUser({ photoUrl });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cb-photo-updated', { detail: { photoUrl } }));
  }
}

export default function PassportPhotoPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        setPhotoUrl(profile.photoUrl || null);
        if (profile.photoUrl) notifyPhotoUpdated(profile.photoUrl);
      })
      .finally(() => setReady(true));
  }, [router]);

  useEffect(() => {
    if (!uploading) return;
    setUploadPct(8);
    const id = window.setInterval(() => {
      setUploadPct((prev) => {
        if (prev >= 88) return prev;
        return prev + Math.max(2, Math.round((90 - prev) * 0.12));
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [uploading]);

  async function onPick(file?: File) {
    if (!file || uploading) return;
    const invalid = photoFileError(file.type, file.size);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError('');
    setUploading(true);
    setUploadPct(10);
    try {
      const blob = await compressImageBlob(file, 420);
      setUploadPct(55);
      const updated = await uploadCandidatePhoto(blob, 'photo.jpg');
      const nextUrl = updated.photoUrl;
      if (!nextUrl) {
        throw new Error('Photo uploaded but was not saved. Please try again.');
      }
      setPhotoUrl(nextUrl);
      notifyPhotoUpdated(nextUrl);
      setUploadPct(100);
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Choose a clear JPG or PNG photo.');
    } finally {
      setUploading(false);
      setUploadPct(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const returnTo = peekReturnTo();
      if (returnTo) {
        goToReturnTo(router, '/dashboard');
        return;
      }
      await goToNextPassportStep(router, 'photo');
    } catch {
      setError('We could not continue right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (uploading) return;
    setError('');
    setUploading(true);
    setUploadPct(40);
    try {
      await updateCandidateMe({ photoUrl: null });
      setPhotoUrl(null);
      notifyPhotoUpdated(null);
      setUploadPct(100);
    } catch {
      setError('Could not remove photo. Try again.');
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  if (!ready) return <PassportLoading />;

  return (
    <PassportFrame
      title="Profile photo"
      subtitle="Optional. A clear photo helps employers recognise you."
      step="photo"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            className="cb-photo-ring"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            aria-label={photoUrl ? 'Change profile photo' : 'Add profile photo'}
          >
            {photoUrl && !uploading ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Profile" className="cb-photo-ring__img" />
            ) : (
              <div className="cb-photo-ring__empty">
                <span className="cb-photo-ring__camera" aria-hidden>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 8.5A2.5 2.5 0 016.5 6h2.1l1.2-1.8A1.5 1.5 0 0111 3.5h2a1.5 1.5 0 011.2.7L15.4 6h2.1A2.5 2.5 0 0120 8.5v9A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5v-9z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </span>
                <span className="cb-photo-ring__stripe">Add Photo</span>
              </div>
            )}
            {uploading ? (
              <div className="cb-photo-ring__upload" aria-live="polite">
                <div className="cb-photo-ring__water" style={{ height: `${Math.max(12, uploadPct)}%` }} />
                <span className="cb-photo-ring__upload-txt">
                  {uploadPct < 100 ? `${uploadPct}%` : '✓'}
                </span>
              </div>
            ) : null}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            disabled={uploading}
            onChange={(event) => void onPick(event.target.files?.[0])}
          />

          <p className="text-center text-xs font-semibold text-slate-500">
            JPG or PNG · compressed before upload to cloud
          </p>

          {photoUrl && !uploading ? (
            <button
              type="button"
              className="text-sm font-semibold text-error"
              onClick={() => void onRemove()}
            >
              Remove photo
            </button>
          ) : null}
        </div>

        {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}

        <WizardActions>
          <Button
            type="submit"
            size="md"
            block={false}
            loading={saving}
            loadingLabel="Saving..."
            disabled={uploading}
            className={passportPrimaryButtonClass}
          >
            {photoUrl ? 'Save and continue' : 'Skip for now'}
          </Button>
        </WizardActions>
      </form>

      <style jsx global>{`
        .cb-photo-ring {
          position: relative;
          width: 148px;
          height: 148px;
          border-radius: 999px;
          border: none;
          padding: 0;
          overflow: hidden;
          cursor: pointer;
          box-shadow: 0 0 0 4px #e8ece6, 0 10px 24px rgba(12, 40, 34, 0.08);
          background: #d7dbd4;
        }
        .cb-photo-ring:disabled {
          cursor: wait;
        }
        .cb-photo-ring__img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .cb-photo-ring__empty {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background:
            repeating-linear-gradient(
              -28deg,
              #cfd4cb,
              #cfd4cb 10px,
              #d9ddd4 10px,
              #d9ddd4 20px
            );
          color: #6b736c;
        }
        .cb-photo-ring__empty::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(160, 168, 158, 0.35);
          pointer-events: none;
        }
        .cb-photo-ring__camera {
          position: relative;
          z-index: 1;
          display: flex;
          color: #5a625b;
          filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.35));
        }
        .cb-photo-ring__stripe {
          position: relative;
          z-index: 1;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #4f574f;
          background: rgba(255, 255, 255, 0.55);
          border: 1px dashed rgba(79, 87, 79, 0.45);
          padding: 5px 10px;
          border-radius: 999px;
        }
        .cb-photo-ring__upload {
          position: absolute;
          inset: 0;
          z-index: 2;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(12, 40, 34, 0.28);
        }
        .cb-photo-ring__water {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(180deg, rgba(56, 189, 148, 0.55), rgba(12, 40, 34, 0.92));
          transition: height 0.2s ease;
        }
        .cb-photo-ring__water::before {
          content: '';
          position: absolute;
          left: -20%;
          right: -20%;
          top: -10px;
          height: 18px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.28);
          animation: cb-photo-wave 1.4s ease-in-out infinite;
        }
        @keyframes cb-photo-wave {
          0%,
          100% {
            transform: translateX(-6%);
          }
          50% {
            transform: translateX(6%);
          }
        }
        .cb-photo-ring__upload-txt {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          color: #fff;
          font-size: 18px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
        }
      `}</style>
    </PassportFrame>
  );
}
