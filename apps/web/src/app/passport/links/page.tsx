'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CandidateLinks } from '@careerbridge/shared';
import { profileLinkErrors } from '@careerbridge/shared';
import { PassportFrame, WizardActions } from '@/components/PassportFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { getCandidateMe, updateCandidateMe } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';

const EMPTY: CandidateLinks = { linkedin: '', github: '', portfolio: '', website: '' };

export default function PassportLinksPage() {
  const router = useRouter();
  const [links, setLinks] = useState<CandidateLinks>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CandidateLinks, string>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => setLinks({ ...EMPTY, ...profile.links }))
      .finally(() => setReady(true));
  }, [router]);

  function setField(key: keyof CandidateLinks, value: string) {
    setLinks((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = profileLinkErrors(links);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError('Fix the highlighted links. Each field must use the matching website.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await updateCandidateMe({ links });
      await goToNextPassportStep(router, 'links');
    } catch {
      setError('We could not save your links right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  const hasAny = Object.values(links).some((item) => item?.trim());

  return (
    <PassportFrame
      title="Professional links"
      subtitle="Optional. Paste the real profile URL for each site ΓÇö LinkedIn for LinkedIn, GitHub for GitHub."
      step="links"
    >
      <form onSubmit={onSubmit} className="cb-passport-panel space-y-4 p-6 sm:p-7">
        <Input
          label="LinkedIn"
          name="linkedin"
          value={links.linkedin || ''}
          onChange={(event) => setField('linkedin', event.target.value)}
          placeholder="https://www.linkedin.com/in/your-name"
          error={fieldErrors.linkedin}
        />
        <Input
          label="GitHub"
          name="github"
          value={links.github || ''}
          onChange={(event) => setField('github', event.target.value)}
          placeholder="https://github.com/your-name"
          error={fieldErrors.github}
        />
        <Input
          label="Portfolio"
          name="portfolio"
          value={links.portfolio || ''}
          onChange={(event) => setField('portfolio', event.target.value)}
          placeholder="https://yourwork.com"
          error={fieldErrors.portfolio}
        />
        <Input
          label="Website"
          name="website"
          value={links.website || ''}
          onChange={(event) => setField('website', event.target.value)}
          placeholder="https://your-site.com"
          error={fieldErrors.website}
        />
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <WizardActions>
          <Button type="submit" size="md" block={false} loading={loading} loadingLabel="Saving...">
            {hasAny ? 'Finish Passport' : 'Skip and finish'}
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
