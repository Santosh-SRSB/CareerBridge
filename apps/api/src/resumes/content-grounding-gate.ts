/**
 * Post-parse safety gate before DB write — does not re-parse the resume.
 * Rejects/replaces fields that cannot be grounded in this upload's rawText
 * so another candidate's values cannot be saved silently.
 */

import type { ResumeContent } from '@careerbridge/shared';
import { groundedInSource, filterGroundedList } from './resume-extract-normalize';

export type GroundingGateResult = {
  content: ResumeContent;
  rejected: Array<{ field: string; value: string; reason: string }>;
};

function nameTokensGrounded(fullName: string, sourceText: string): boolean {
  const name = fullName.trim();
  if (!name || /^candidate$/i.test(name)) return true;
  if (groundedInSource(name, sourceText)) return true;
  // Allow first+last when both appear somewhere in the text (order may differ)
  const parts = name.split(/\s+/).filter((p) => p.length > 1);
  if (parts.length >= 2 && parts.every((p) => groundedInSource(p, sourceText))) return true;
  return false;
}

/**
 * Strip ungrounded identity/education/skill/language fields before persistence.
 */
export function applyContentGroundingGate(
  content: ResumeContent,
  rawText: string,
  options?: { profileName?: string | null },
): GroundingGateResult {
  const rejected: GroundingGateResult['rejected'] = [];
  const source = rawText || '';
  let next: ResumeContent = { ...content };

  if (source.trim() && next.fullName && !nameTokensGrounded(next.fullName, source)) {
    rejected.push({ field: 'fullName', value: next.fullName, reason: 'not_in_source_text' });
    const profile = String(options?.profileName || '').trim();
    if (profile && nameTokensGrounded(profile, source)) {
      next.fullName = profile;
    } else {
      next.fullName = 'Candidate';
    }
  }

  if (source.trim() && Array.isArray(next.skills) && next.skills.length) {
    const kept = filterGroundedList(next.skills, source);
    for (const s of next.skills) {
      if (!kept.includes(s)) rejected.push({ field: 'skills', value: s, reason: 'not_in_source_text' });
    }
    next.skills = kept;
  }

  if (source.trim() && Array.isArray(next.languages) && next.languages.length) {
    const kept = filterGroundedList(next.languages, source);
    for (const l of next.languages) {
      if (!kept.includes(l)) rejected.push({ field: 'languages', value: l, reason: 'not_in_source_text' });
    }
    next.languages = kept;
  }

  if (source.trim() && Array.isArray(next.education) && next.education.length) {
    const kept = next.education.filter((row) => {
      const q = String(row.qualification || '').trim();
      const inst = String(row.institution || '').trim();
      const ok =
        (!q || groundedInSource(q, source) || groundedInSource(q.replace(/\./g, ''), source)) &&
        (!inst || groundedInSource(inst, source));
      if (!ok) {
        rejected.push({
          field: 'education',
          value: [q, inst].filter(Boolean).join(' | '),
          reason: 'not_in_source_text',
        });
      }
      return ok;
    });
    next.education = kept;
  }

  if (rejected.length) {
    next.fieldConfidence = [
      ...(next.fieldConfidence || []),
      ...rejected.map((r) => ({
        field: r.field,
        value: r.value.slice(0, 80),
        confidence: 0.15,
        source: `grounding_gate:${r.reason}`,
      })),
    ];
  }

  if (next.personal) {
    next.personal = {
      ...next.personal,
      fullName: next.fullName,
    };
  }

  return { content: next, rejected };
}
