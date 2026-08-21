'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { photoFileError } from '@careerbridge/shared';
import { PassportFrame, WizardActions } from '@/components/PassportFrame';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';
import { compressImageFile } from '@/lib/image';

export default function PassportPhotoPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => setPhotoUrl(profile.photoUrl || null))
      .finally(() => setReady(true));
  }, [router]);

  async function onPick(file?: File) {
    if (!file) return;
    const invalid = photoFileError(file.type, file.size);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError('');
    try {
      setPhotoUrl(await compressImageFile(file));
    } catch {
      setError('Choose a clear JPG or PNG photo.');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (photoUrl) await updateCandidateMe({ photoUrl });
      await goToNextPassportStep(router, 'photo');
    } catch {
      setError('We could not save your photo right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  return (
    <PassportFrame
      title="Profile photo"
      subtitle="Optional. A clear photo helps employers recognise you."
      step="photo"
    >
      <form onSubmit={onSubmit} className="cb-passport-panel space-y-5 p-6 sm:p-7">
        <div className="flex flex-col items-center gap-4">
          <div className="cb-profile-photo-lg">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Profile" />
            ) : (
              <span>Photo</span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void onPick(event.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="md" block={false} variant="secondary" onClick={() => inputRef.current?.click()}>
              {photoUrl ? 'Change photo' : 'Upload photo'}
            </Button>
            {photoUrl ? (
              <button
                type="button"
                className="text-sm font-semibold text-error"
                onClick={() => {
                  setPhotoUrl(null);
                  void updateCandidateMe({ photoUrl: null });
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <WizardActions>
          <Button type="submit" size="md" block={false} loading={loading} loadingLabel="Saving...">
            {photoUrl ? 'Save and continue' : 'Skip for now'}
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
