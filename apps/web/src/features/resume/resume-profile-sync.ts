import type { CandidateLinks, CandidateProfile, ResumeContent, SavePassportPayload } from '@careerbridge/shared';
import { normalizeHttpUrl, profileLinkError } from '@careerbridge/shared';
import { mapResumeContentToPassportPayload } from './resume-content-to-passport';

const RESUME_LINK_KEYS = ['linkedin', 'github', 'portfolio'] as const;
type ResumeLinkKey = (typeof RESUME_LINK_KEYS)[number];

/** `ProfileLinksDto` caps each link at 300 characters. */
const PROFILE_LINK_MAX = 300;

/** Upper bound of `SavePassportDto.gapMonths`. */
const GAP_MONTHS_MAX = 600;

function comparableUrl(value?: string | null) {
  const normalized = normalizeHttpUrl(value);
  return normalized ? normalized.replace(/\/+$/, '').toLowerCase() : '';
}

/**
 * Profile links with the resume's valid links applied over the existing ones.
 * `PATCH /candidates/me` replaces the stored links wholesale, so every existing link is carried over.
 * Returns null when the profile already holds the same links (nothing to send).
 */
export function mergeResumeLinksIntoProfile(
  existing: CandidateLinks | null | undefined,
  incoming: Partial<Record<ResumeLinkKey, string | null>>,
): CandidateLinks | null {
  const merged: CandidateLinks = { ...(existing || {}) };
  let changed = false;
  for (const key of RESUME_LINK_KEYS) {
    const raw = incoming[key]?.trim();
    if (!raw || profileLinkError(key, raw)) continue;
    const normalized = normalizeHttpUrl(raw);
    if (!normalized || normalized.length > PROFILE_LINK_MAX) continue;
    if (comparableUrl(merged[key]) === comparableUrl(normalized)) continue;
    merged[key] = normalized;
    changed = true;
  }
  return changed ? merged : null;
}

export type ResumeGapState = {
  hasGap: boolean;
  gapMonths: number;
  gapReason: string;
};

type PreservedProfileFields = Pick<
  CandidateProfile,
  'totalExperienceYears' | 'totalExperienceMonths' | 'gapReason' | 'gapMonths'
>;

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function clampGapMonths(value: number) {
  return Math.min(GAP_MONTHS_MAX, Math.max(0, Math.floor(value || 0)));
}

/**
 * `PUT /candidates/me/passport` writes every scalar it owns, defaulting missing ones (experience years → 0,
 * gap reason → null). Carry the values the resume does not contain so the save does not reset them.
 * Values already in the payload win. With `gap` (the wizard's live gap state) the gap fields follow the wizard;
 * without it the profile's existing gap explanation is kept.
 */
export function withPreservedProfileFields(
  payload: SavePassportPayload,
  existing: Partial<PreservedProfileFields> | null | undefined,
  gap?: ResumeGapState,
): SavePassportPayload {
  const next: SavePassportPayload = { ...payload };
  if (next.totalExperienceYears === undefined && isCount(existing?.totalExperienceYears)) {
    next.totalExperienceYears = String(existing.totalExperienceYears);
  }
  if (next.totalExperienceMonths === undefined && isCount(existing?.totalExperienceMonths)) {
    next.totalExperienceMonths = String(existing.totalExperienceMonths);
  }
  if (gap) {
    if (gap.hasGap) {
      next.gapReason = gap.gapReason.trim() || undefined;
      next.gapMonths = clampGapMonths(gap.gapMonths);
    }
    return next;
  }
  const existingReason = existing?.gapReason?.trim();
  if (next.gapReason === undefined && existingReason) next.gapReason = existingReason;
  if (next.gapMonths === undefined && isCount(existing?.gapMonths)) next.gapMonths = clampGapMonths(existing.gapMonths);
  return next;
}

export type ResumeProfileSyncApi = {
  getCandidateMe: () => Promise<CandidateProfile | null>;
  savePassport: (payload: SavePassportPayload) => Promise<CandidateProfile>;
};

/**
 * Save resume content into the profile without resetting values the resume does not carry.
 * The current profile is read first; if that read fails the save is not attempted (the error propagates),
 * because saving blind would reset experience years and the gap explanation.
 */
export async function syncResumeToProfile(
  content: ResumeContent,
  api: ResumeProfileSyncApi,
  gap?: ResumeGapState,
): Promise<{ profile: CandidateProfile; existing: CandidateProfile | null }> {
  const existing = await api.getCandidateMe();
  const profile = await api.savePassport(
    withPreservedProfileFields(mapResumeContentToPassportPayload(content), existing, gap),
  );
  return { profile, existing };
}
