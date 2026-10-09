'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CANDIDATE_MAX_SKILLS, CANDIDATE_MAX_SKILLS_MESSAGE } from '@careerbridge/shared';
import {
  OnboardingActions,
  OnboardingError,
  OnboardingFieldIcon,
  OnboardingFrame,
  OnboardingIcon,
  OnboardingLoading,
  OnboardingQuestion,
  OnboardingStepHeader,
  obxPrimaryButtonClass,
} from '@/components/OnboardingFrame';
import { Button } from '@/components/ui/Button';
import {
  addSkill,
  getCandidateMe,
  removeSkill,
  searchSkillCatalog,
  updateCandidateMe,
  type SkillCatalogEntry,
} from '@/lib/api';
import { patchStoredUser } from '@/lib/session';
import { nextOnboardingStepPath, withSkippedStep } from '@/lib/onboarding-flow';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';
import { ONBOARDING_SAVE_ERROR, useOnboardingSkip } from '@/hooks/useOnboardingSkip';

const NO_SKILLS_FOUND = 'No skills found. Try a different search term.';
const SEARCH_DEBOUNCE_MS = 250;
/** Quick-add suggestions shown before the candidate searches; nothing is added until tapped. */
const POPULAR_SKILLS = [
  'Communication',
  'Excel',
  'React',
  'Python',
  'Project Management',
  'SQL',
  'JavaScript',
  'Leadership',
  'Data Analysis',
];

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; results: SkillCatalogEntry[] };

export default function OnboardingSkillsPage() {
  const router = useRouter();
  const gateReady = useOnboardingGate(4);
  const [profileReady, setProfileReady] = useState(false);
  const [existing, setExisting] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [limitError, setLimitError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);
  const { skip, skipping, skipError } = useOnboardingSkip(4, skippedSteps);

  useEffect(() => {
    if (!gateReady) return;
    getCandidateMe()
      .then((profile) => {
        setExisting(profile.skills);
        setSelected(profile.skills.map((skill) => skill.name));
        setSkippedSteps(profile.onboardingSkippedSteps ?? []);
      })
      .finally(() => setProfileReady(true));
  }, [gateReady]);

  const runSearch = useCallback((text: string) => {
    const term = text.trim();
    if (!term) {
      setSearch({ status: 'idle' });
      return;
    }
    const seq = ++requestSeq.current;
    setSearch({ status: 'loading' });
    searchSkillCatalog(term)
      .then((results) => {
        if (seq === requestSeq.current) setSearch({ status: 'done', results: results.slice(0, 12) });
      })
      .catch(() => {
        if (seq === requestSeq.current) setSearch({ status: 'error' });
      });
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, runSearch]);

  function isSelected(name: string) {
    return selected.some((item) => item.toLowerCase() === name.toLowerCase());
  }

  function addToSelection(name: string) {
    const value = name.trim();
    if (!value || isSelected(value)) return;
    if (selected.length >= CANDIDATE_MAX_SKILLS) {
      setLimitError(CANDIDATE_MAX_SKILLS_MESSAGE);
      return;
    }
    setLimitError('');
    setSelected((prev) => [...prev, value]);
    setQuery('');
  }

  function removeFromSelection(name: string) {
    setLimitError('');
    setSelected((prev) => prev.filter((item) => item !== name));
  }

  async function complete() {
    setError('');
    setLoading(true);
    try {
      const existingByName = new Map(existing.map((skill) => [skill.name.toLowerCase(), skill]));
      const removed = existing.filter((skill) => !isSelected(skill.name));
      for (const skill of removed) await removeSkill(skill.id);
      for (const name of selected) {
        if (!existingByName.has(name.toLowerCase())) await addSkill({ name });
      }
      await updateCandidateMe({
        onboardingCompleted: true,
        onboardingSkippedSteps: withSkippedStep(skippedSteps, 4, false),
      });
      patchStoredUser({ onboardingCompleted: true });
      router.push(nextOnboardingStepPath(4));
    } catch {
      setError(ONBOARDING_SAVE_ERROR);
      const fresh = await getCandidateMe().catch(() => null);
      if (fresh) setExisting(fresh.skills);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void complete();
  }

  if (!gateReady || !profileReady) return <OnboardingLoading step={4} />;

  const results = search.status === 'done' ? search.results.filter((item) => !isSelected(item.name)) : [];
  const quickAdd = POPULAR_SKILLS.filter((name) => !isSelected(name));

  return (
    <OnboardingFrame step={4} onSkip={() => void skip()} skipDisabled={skipping || loading}>
      <form onSubmit={onSubmit} noValidate className="obx-form">
        <div className="obx-body">
          <OnboardingStepHeader icon="sparkle" title="Your skills" subtitle="Add the skills employers should see." />

          <OnboardingQuestion title="Search skills" htmlFor="skill-search">
            <div className="obx-field">
              <OnboardingFieldIcon>
                <OnboardingIcon name="search" size={18} />
              </OnboardingFieldIcon>
              <input
                id="skill-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (results[0]) addToSelection(results[0].name);
                  }
                }}
                aria-label="Search skills"
                aria-controls="skill-suggestions"
                placeholder="e.g. Communication, Excel, React"
                autoComplete="off"
              />
            </div>
          </OnboardingQuestion>
          <p className="obx-cnt" aria-live="polite">
            {selected.length} added
            <span className="sr-only"> of {CANDIDATE_MAX_SKILLS} allowed</span>
          </p>

          {selected.length ? (
            <ul className="obx-chips" aria-label="Selected skills">
              {selected.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => removeFromSelection(name)}
                    aria-label={`Remove ${name}`}
                    className="obx-opt obx-chip is-on"
                  >
                    <OnboardingIcon name="check" size={14} />
                    {name}
                    <b aria-hidden>×</b>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div id="skill-suggestions" aria-live="polite">
            {search.status === 'loading' ? (
              <div role="status" data-testid="skill-search-loading" className="obx-chips">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="obx-skel" style={{ height: 40, width: 110 }} />
                ))}
                <span className="sr-only">Searching skills…</span>
              </div>
            ) : search.status === 'error' ? (
              <OnboardingError
                message="We couldn't load skills right now."
                onRetry={() => runSearch(query)}
              />
            ) : search.status === 'done' && results.length === 0 ? (
              <div>
                <p className="obx-muted">{NO_SKILLS_FOUND}</p>
                {query.trim().length >= 2 && !isSelected(query) ? (
                  <button type="button" onClick={() => addToSelection(query)} className="obx-link">
                    Add “{query.trim()}” as a skill
                  </button>
                ) : null}
              </div>
            ) : (
              <ul
                className="obx-chips"
                aria-label={search.status === 'done' ? 'Skill suggestions' : 'Popular skills'}
              >
                {(search.status === 'done' ? results.map((item) => item.name) : quickAdd).map((name) => (
                  <li key={name}>
                    <button type="button" onClick={() => addToSelection(name)} className="obx-opt obx-chip">
                      <b aria-hidden>+</b>
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <OnboardingError message={limitError} />

          <OnboardingError
            message={error || skipError}
            onRetry={error ? () => void complete() : skipError ? () => void skip() : undefined}
          />
        </div>

        <OnboardingActions step={4}>
          <Button
            type="submit"
            block={false}
            loading={loading}
            loadingLabel="Saving..."
            className={obxPrimaryButtonClass}
          >
            Complete profile
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
