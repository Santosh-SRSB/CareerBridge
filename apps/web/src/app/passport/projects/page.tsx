'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { optionalUrlError, yearError, type CandidateProject } from '@careerbridge/shared';
import { PassportFrame, WizardActions } from '@/components/PassportFrame';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import { addProject, getCandidateMe, removeProject } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';

export default function PassportProjectsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CandidateProject[]>([]);
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
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
      .then((profile) => setItems(profile.projects || []))
      .finally(() => setReady(true));
  }, [router]);

  function resetForm() {
    setTitle('');
    setRole('');
    setYear('');
    setDescription('');
    setUrl('');
  }

  async function saveCurrent() {
    if (title.trim().length < 2) {
      setError('Enter the project or volunteer work title.');
      return null;
    }
    const invalidYear = yearError(year);
    if (invalidYear) {
      setError(invalidYear);
      return null;
    }
    const urlError = optionalUrlError(url);
    if (urlError) {
      setError(urlError);
      return null;
    }
    const profile = await addProject({
      title: title.trim(),
      role: role.trim() || undefined,
      year: year ? Number(year) : undefined,
      description: description.trim() || undefined,
      url: url.trim() || undefined,
    });
    setItems(profile.projects);
    resetForm();
    return profile.projects;
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await saveCurrent();
    } catch {
      setError('We could not save that project right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onContinue() {
    setError('');
    setLoading(true);
    try {
      if (title.trim()) {
        const saved = await saveCurrent();
        if (!saved) {
          setLoading(false);
          return;
        }
      }
      await goToNextPassportStep(router, 'projects');
    } catch {
      setError('We could not save that project right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  return (
    <PassportFrame
      title="Projects"
      subtitle="Projects and volunteer work can fill gaps if you are just starting out."
      step="projects"
    >
      <form onSubmit={onAdd} className="cb-passport-panel space-y-4 p-6 sm:p-7">
        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="cb-wizard-record">
                <div>
                  <p className="text-sm font-semibold text-primary">{item.title}</p>
                  <p className="text-xs text-muted">
                    {[item.role, item.year].filter(Boolean).join(' · ')}
                  </p>
                  {item.description ? <p className="mt-1 text-xs text-muted">{item.description}</p> : null}
                  {item.url ? (
                    <p className="mt-1 truncate text-xs font-semibold text-teal">{item.url}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-error"
                  onClick={async () => setItems((await removeProject(item.id)).projects)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <Input
          label="Project or volunteer work"
          name="projectTitle"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="College project, NGO work, freelance"
        />
        <Input
          label="Your role"
          name="projectRole"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          placeholder="Team lead, volunteer, developer"
        />
        <Input
          label="Year"
          name="projectYear"
          inputMode="numeric"
          value={year}
          onChange={(event) => setYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="2025"
        />
        <Textarea
          label="What did you do?"
          name="projectDescription"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="A short summary of the work, tools, and outcome"
        />
        <Input
          label="Project link (optional)"
          name="projectUrl"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="github.com/you/project or live demo"
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
            Add project
          </Button>
          <Button type="button" size="md" block={false} loading={loading} loadingLabel="Saving..." onClick={() => void onContinue()}>
            {items.length || title.trim() ? 'Save and continue' : 'Skip for now'}
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
