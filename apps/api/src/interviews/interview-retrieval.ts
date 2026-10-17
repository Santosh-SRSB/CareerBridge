import type { StoredChunkHit } from '../ai/vector-store.service';

export type FocusKind = 'EDUCATION' | 'PROJECT' | 'EXPERIENCE' | 'SKILL' | 'ROLE' | 'BEHAVIOURAL' | 'GENERAL';

export type RetrievalPlan = {
  focusKind: FocusKind;
  focusLabel: string;
  query: string;
  /** Restrict retrieval to these resume sections; null = any section. */
  sections: string[] | null;
  focusSkill: string | null;
};

/** Candidate pool fetched per question before diversity selection; the prompt still gets at most CONTEXT_LIMIT. */
export const RETRIEVAL_POOL = 8;
export const CONTEXT_LIMIT = 4;

/**
 * Turns the coverage focus into a retrieval query. Section-targeted focuses search only that section so a
 * question about education retrieves education chunks; skill focuses name one concrete skill.
 * The last answer only steers open-ended focuses, otherwise it would drag retrieval back to the previous topic.
 */
export function buildRetrievalPlan(input: {
  focusKind: FocusKind;
  profile: { skills: string[]; focusStacks: string[]; jobRole: string };
  asked: string[];
  lastAnswer?: string | null;
}): RetrievalPlan {
  const role = input.profile.jobRole?.trim() || 'software developer';
  const answer = usableAnswer(input.lastAnswer);
  switch (input.focusKind) {
    case 'EDUCATION':
      return plan(input.focusKind, 'education', 'Education: degree, college or university, course and subjects studied', ['Education']);
    case 'PROJECT':
      return plan(
        input.focusKind,
        'project',
        'Project the candidate built: application features, their responsibilities and technologies used',
        ['Projects'],
      );
    case 'EXPERIENCE':
      return plan(
        input.focusKind,
        'work experience',
        'Work experience: company, job title, responsibilities and what the candidate delivered',
        ['Experience'],
      );
    case 'SKILL': {
      const skill = pickNextSkill([...input.profile.focusStacks, ...input.profile.skills], input.asked);
      if (!skill) {
        return plan(input.focusKind, 'technical skills', `Technical skills and tools used as a ${role}`, null);
      }
      return {
        ...plan(input.focusKind, `technical skill: ${skill}`, `Experience using ${skill}: projects and work where ${skill} was used`, null),
        focusSkill: skill,
      };
    }
    default: {
      const base = `${role}: relevant experience, projects and achievements`;
      return plan(input.focusKind, input.focusKind.toLowerCase(), answer ? `${answer}\n${base}` : base, null);
    }
  }
}

/**
 * Relevance first: hits arrive sorted by score and already above the threshold. Among those, chunks not yet
 * used in this interview come first; previously used chunks only fill remaining slots.
 */
export function selectDiverseChunks(
  hits: StoredChunkHit[],
  usedChunkIds: Iterable<string>,
  limit = CONTEXT_LIMIT,
): StoredChunkHit[] {
  const used = new Set(usedChunkIds);
  const fresh = hits.filter((hit) => !used.has(hit.id));
  const reused = hits.filter((hit) => used.has(hit.id));
  return [...fresh, ...reused].slice(0, limit);
}

export function pickNextSkill(skills: string[], asked: string[]): string | null {
  const askedText = asked.join('\n').toLowerCase();
  const seen = new Set<string>();
  for (const raw of skills) {
    const skill = raw.trim();
    const key = skill.toLowerCase().replace(/\.js$|\s+js$/i, '');
    // Single-letter names (e.g. "C") cannot be matched reliably against question text.
    if (key.replace(/[^a-z0-9+#]/g, '').length < 2 || seen.has(key)) continue;
    seen.add(key);
    if (!askedText.includes(key)) return skill;
  }
  return null;
}

function usableAnswer(answer?: string | null): string {
  const text = (answer || '').trim();
  if (text.length < 20 || /^audio answer/i.test(text)) return '';
  return text.slice(0, 300);
}

function plan(focusKind: FocusKind, focusLabel: string, query: string, sections: string[] | null): RetrievalPlan {
  return { focusKind, focusLabel, query, sections, focusSkill: null };
}
