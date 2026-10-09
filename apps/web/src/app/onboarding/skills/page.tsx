'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CANDIDATE_MAX_SKILLS, CANDIDATE_MAX_SKILLS_MESSAGE } from '@careerbridge/shared';
import {
  OB,
  OnboardingActions,
  OnboardingError,
  OnboardingFrame,
  OnboardingQuestion,
  OnboardingStepHeader,
  onboardingInputClass,
  onboardingPrimaryButtonClass,
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

  if (!gateReady || !profileReady) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ background: OB.bg, color: OB.muted }}>
        Loading...
      </main>
    );
  }

  const results = search.status === 'done' ? search.results.filter((item) => !isSelected(item.name)) : [];

  return (
    <OnboardingFrame step={4}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden pb-1">
          <OnboardingStepHeader title="Your skills" subtitle="Add the skills employers should see." />

          <OnboardingQuestion
            title="Search skills"
            hint={`${selected.length}/${CANDIDATE_MAX_SKILLS} skills added`}
          >
            <input
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
              className={onboardingInputClass}
              autoComplete="off"
            />
            <div id="skill-suggestions" aria-live="polite" className="mt-2">
              {search.status === 'loading' ? (
                <div role="status" data-testid="skill-search-loading" className="space-y-1.5">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded-[8px] bg-[#e9e8e3]" />
                  ))}
                  <span className="sr-only">Searching skills…</span>
                </div>
              ) : search.status === 'error' ? (
                <OnboardingError
                  message="We couldn't load skills right now."
                  onRetry={() => runSearch(query)}
                />
              ) : search.status === 'done' && results.length === 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[13px]" style={{ color: OB.muted }}>
                    {NO_SKILLS_FOUND}
                  </p>
                  {query.trim().length >= 2 && !isSelected(query) ? (
                    <button
                      type="button"
                      onClick={() => addToSelection(query)}
                      className="min-h-12 text-xs font-semibold"
                      style={{ color: OB.accent }}
                    >
                      Add “{query.trim()}” as a skill
                    </button>
                  ) : null}
                </div>
              ) : results.length ? (
                <ul className="flex flex-wrap gap-2" aria-label="Skill suggestions">
                  {results.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => addToSelection(item.name)}
                        className="min-h-12 rounded-full border px-3.5 text-[13px] transition hover:border-[#10137C]"
                        style={{ borderColor: OB.borderStrong, color: OB.ink, background: OB.surface }}
                      >
                        + {item.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <OnboardingError message={limitError} />
          </OnboardingQuestion>

          {selected.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Selected skills">
              {selected.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => removeFromSelection(name)}
                    aria-label={`Remove ${name}`}
                    className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-3 text-[13px] text-white"
                    style={{ background: OB.accent }}
                  >
                    {name} <span aria-hidden>×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px]" style={{ color: OB.muted }}>
              No skills added yet.
            </p>
          )}

          <OnboardingError
            message={error || skipError}
            onRetry={error ? () => void complete() : skipError ? () => void skip() : undefined}
          />
        </div>

        <OnboardingActions step={4} onSkip={() => void skip()} skipDisabled={skipping || loading}>
          <Button
            type="submit"
            size="sm"
            block
            loading={loading}
            loadingLabel="Saving..."
            className={onboardingPrimaryButtonClass}
            style={{ background: OB.accent }}
          >
            Complete Profile
          </Button>
        </OnboardingActions>
      </form>
    </OnboardingFrame>
  );
}
