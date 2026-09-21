/**
 * Post-extraction sanity checks — flag issues; do not invent replacements.
 * Pure heuristic.
 */

import type { ResumeContent } from '@careerbridge/shared';
import { looksLikePersonalLeakToken } from './pii-sweep';

export type ExtractionIssue = {
  field: string;
  value: string;
  reason: string;
  severity: 'warn' | 'error';
};

function isFragmentBullet(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return true;
  if (/^[a-z]/.test(t) && !/[.!?]$/.test(t) && t.length < 40) return true;
  if (/^(and|or|of|to|for|with|on|in|at|the)\b/i.test(t) && t.length < 35) return true;
  return false;
}

function companyLooksWeak(company: string): boolean {
  const c = company.trim();
  if (!c) return true;
  if (!/[A-Z]/.test(c)) return true;
  if (/^(the|and|or|with|from|to|for)\b/i.test(c)) return true;
  if (/^worked on technologies\b/i.test(c)) return true;
  return false;
}

/**
 * Sanitize + flag. Returns cleaned content and issues for fieldConfidence/notes.
 */
export function validateAndSanitizeExtracted(content: ResumeContent): {
  content: ResumeContent;
  issues: ExtractionIssue[];
} {
  const issues: ExtractionIssue[] = [];

  const skills = (content.skills || []).filter((s) => {
    if (looksLikePersonalLeakToken(s) || /father|dob|marital|#\d|cross,/i.test(s)) {
      issues.push({ field: 'skills', value: s, reason: 'personal_or_address_leak', severity: 'error' });
      return false;
    }
    if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(s) && s.split(' ').length === 2 && s.length < 28) {
      // Possible person name mistaken as skill — warn only if also looks non-tech
      if (!/(java|sql|react|aws|excel|python|manager|lead)/i.test(s)) {
        issues.push({ field: 'skills', value: s, reason: 'name_like_token', severity: 'warn' });
      }
    }
    return true;
  });

  const languages = (content.languages || []).filter((l) => {
    if (looksLikePersonalLeakToken(l) || /\d|cross|main|address|bangalore\s*-/i.test(l)) {
      issues.push({ field: 'languages', value: l, reason: 'address_or_non_language', severity: 'error' });
      return false;
    }
    return true;
  });

  const experiences = (content.experiences || []).map((exp, idx) => {
    if (companyLooksWeak(exp.company || '')) {
      issues.push({
        field: `experiences[${idx}].company`,
        value: exp.company || '',
        reason: 'weak_company',
        severity: exp.company ? 'warn' : 'warn',
      });
    }
    const responsibilities = (exp.responsibilities || []).filter((b) => {
      if (isFragmentBullet(b)) {
        issues.push({
          field: `experiences[${idx}].responsibilities`,
          value: b,
          reason: 'fragment_bullet',
          severity: 'warn',
        });
        // Keep after reflow; only drop ultra-short garbage
        return b.trim().length >= 8;
      }
      return true;
    });
    return { ...exp, responsibilities };
  });

  const fieldConfidence = [
    ...(content.fieldConfidence || []),
    ...issues
      .filter((i) => i.severity === 'error')
      .map((i) => ({
        field: i.field,
        value: i.value.slice(0, 80),
        confidence: 0.25,
        source: `validation:${i.reason}`,
      })),
  ];

  return {
    content: {
      ...content,
      skills,
      languages,
      experiences,
      fieldConfidence,
    },
    issues,
  };
}
