'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXPERIENCE_OPTIONS, dateRangeError, type CandidateExperience } from '@careerbridge/shared';
import { Chip, PassportFrame, WizardActions } from '@/components/PassportFrame';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import { addExperience, getCandidateMe, removeExperience, updateCandidateMe } from '@/lib/api';
import { goToNextPassportStep } from '@/lib/passport-flow';

function formatRange(start?: string | null, end?: string | null) {
  if (!start && !end) return '';
  const startLabel = start ? new Date(start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Start';
  const endLabel = end ? new Date(end).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Present';
  return `${startLabel} – ${endLabel}`;
}

export default function PassportExperiencePage() {
  const router = useRouter();
  const [hasExperience, setHasExperience] = useState('');
  const [items, setItems] = useState<CandidateExperience[]>([]);
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentRole, setCurrentRole] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        setHasExperience(profile.hasExperience || '');
        setItems(profile.experiences);
      })
      .finally(() => setReady(true));
  }, [router]);

  function resetForm() {
    setCompany('');
    setJobTitle('');
    setStartDate('');
    setEndDate('');
    setCurrentRole(false);
    setDescription('');
  }

  async function saveCurrentJob() {
    if (company.trim().length < 2 || jobTitle.trim().length < 2) {
      setError('Enter company and job title.');
      return null;
    }
    if (!startDate) {
      setError('Enter the start date.');
      return null;
    }
    const rangeError = dateRangeError(startDate, endDate, currentRole);
    if (rangeError) {
      setError(rangeError);
      return null;
    }
    const profile = await addExperience({
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      startDate: startDate || undefined,
      endDate: currentRole ? undefined : endDate || undefined,
      description: description.trim() || undefined,
      isInternship: hasExperience === 'INTERNSHIP',
    });
    setItems(profile.experiences);
    resetForm();
    return profile;
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await updateCandidateMe({ hasExperience });
      await saveCurrentJob();
    } catch {
      setError('We could not save that job right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onContinue() {
    if (!hasExperience) {
      setError('Tell us if you have previous work experience.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      let profile = await updateCandidateMe({ hasExperience });
      if (hasExperience !== 'NONE') {
        if (company.trim() || jobTitle.trim()) {
          const saved = await saveCurrentJob();
          if (!saved) {
            setLoading(false);
            return;
          }
          profile = saved;
        }
        if (!profile.experiences.length) {
          setError('Add at least one job, internship, or choose No experience.');
          return;
        }
      }
      patchStoredUser({ onboardingCompleted: profile.onboardingCompleted });
      await goToNextPassportStep(router, 'experience');
    } catch {
      setError('We could not save your experience right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return <main className="cb-wizard text-muted">Loading your Career Passport...</main>;

  const showJobForm = hasExperience && hasExperience !== 'NONE';

  return (
    <PassportFrame
      title="Work experience"
      subtitle="Even internships and first jobs help employers understand what you can do."
      step="experience"
    >
      <form onSubmit={onAdd} className="cb-passport-panel space-y-4 p-6 sm:p-7">
        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="cb-wizard-record">
                <div>
                  <p className="text-sm font-semibold text-primary">{item.jobTitle}</p>
                  <p className="text-xs text-muted">
                    {[item.company, formatRange(item.startDate, item.endDate), item.isInternship ? 'Internship' : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-error"
                  onClick={async () => setItems((await removeExperience(item.id)).experiences)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-semibold text-primary">Your experience</p>
          <div className="flex flex-wrap gap-1.5">
            {EXPERIENCE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                selected={hasExperience === option.value}
                onClick={() => setHasExperience(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>
        {showJobForm ? (
          <>
            <Input label="Company" name="company" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company or organisation" />
            <Input label="Job title" name="jobTitle" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Full Stack, Sales Associate" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Start date" name="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              <Input
                label="End date"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                disabled={currentRole}
              />
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold text-primary">
              <input
                type="checkbox"
                className="size-4 shrink-0"
                checked={currentRole}
                onChange={(event) => setCurrentRole(event.target.checked)}
              />
              I currently work here
            </label>
            <Textarea
              label="What did you do?"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Your role, tools, and what you delivered"
            />
          </>
        ) : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <WizardActions>
          {showJobForm ? (
            <Button
              type="submit"
              size="md"
              block={false}
              loading={loading}
              loadingLabel="Saving..."
              variant="secondary"
              className="cb-wizard-secondary"
            >
              Add job
            </Button>
          ) : null}
          <Button type="button" size="md" block={false} loading={loading} loadingLabel="Saving..." onClick={() => void onContinue()}>
            Save and continue
          </Button>
        </WizardActions>
      </form>
    </PassportFrame>
  );
}
