/**
 * Employer / job boundary heuristics — pure regex, no LLM (plan C).
 * Detects when a line starts a new job even if it is bullet-prefixed.
 */

const BULLET = /^[-•*▪◦●]\s+/;
const NUMBERED = /^\d+[.)]\s+/;

export function stripLeadMarker(line: string): string {
  return line.trim().replace(BULLET, '').replace(NUMBERED, '').trim();
}

const COMPANY_SIGNAL =
  /\b(pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|llc|inc\.?|corp\.?|technologies|solutions|systems|softwares?|labs?|studios?|consulting|services|company|group|india|global)\b/i;

const TITLE_SIGNAL =
  /\b(engineer|developer|manager|analyst|consultant|architect|lead|intern|founder|ceo|cto|director|associate|specialist|designer|tester|qa|executive|officer|administrator|programmer|scientist|trainee|coordinator|recruiter|owner)\b/i;

const DATE_HINT =
  /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|(?:19|20)\d{2}|present|current|till\s*date)\b/i;

const PROSE_JOB =
  /(?:worked|working)\s+as\s+.+\s+(?:at\s+.+?\s+)?from\s+/i;

/** Company-only line that should not become a responsibility bullet. */
export function isCompanyOnlyBullet(line: string): boolean {
  const bare = stripLeadMarker(line);
  if (!bare || bare.length > 70) return false;
  if (PROSE_JOB.test(bare)) return false;
  if (TITLE_SIGNAL.test(bare) && DATE_HINT.test(bare)) return false;
  return COMPANY_SIGNAL.test(bare) && !/^[•\-]/.test(bare.slice(0, 1));
}

/**
 * True when this line likely starts a new employer block (even if bullet-prefixed).
 */
export function looksLikeEmployerBoundary(line: string, nextLine?: string): boolean {
  const bare = stripLeadMarker(line);
  if (!bare || bare.length < 3) return false;
  if (/^responsibilities\s*:?\s*$/i.test(bare)) return false;
  if (PROSE_JOB.test(bare)) return true;
  if (COMPANY_SIGNAL.test(bare) && bare.length < 80 && !/^(managed|handling|worked on|developed)/i.test(bare)) {
    // Bare company name (optionally with dates)
    if (!TITLE_SIGNAL.test(bare) || DATE_HINT.test(bare)) return true;
  }
  if (TITLE_SIGNAL.test(bare) && bare.length < 80) {
    if (DATE_HINT.test(bare)) return true;
    const nextBare = nextLine ? stripLeadMarker(nextLine) : '';
    if (nextBare && (COMPANY_SIGNAL.test(nextBare) || DATE_HINT.test(nextBare))) return true;
  }
  return false;
}
