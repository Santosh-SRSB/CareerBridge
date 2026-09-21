/**
 * Layout & text sanitation for resume extraction.
 * - Strip OCR / PDF artifacts
 * - Stitch broken bullets and mid-sentence wraps
 * - Re-associate orphaned role titles with company blocks
 * - Sanitize invalid / non-standard dates
 */

import { normalizeResumeDateForStorage, parseResumeDate } from '@careerbridge/shared';
import { reflowBulletWraps, isBulletLine, stripBulletMarker } from './bullet-reflow';
import type { ParsedResumeSchema, ParsedWorkExperience } from './parsed-resume.schema';

const ARTIFACT_RE =
  /\$=\d+\$|\$\d+\$|\{tc[^}]*\}|Ã¢â‚¬Â¢|â€¢|ï¿½|\uFFFD|\[\s*image\s*\]|\[\s*photo\s*\]|\bCID:[\w.@-]+/gi;

const ROLE_TITLE_RE =
  /^(?:founder(?:\s*[&+/and]\s*ceo)?|co-?founder|ceo|cto|coo|cfo|president|director|managing\s+director|technical\s+architect|solutions?\s+architect|software\s+architect|principal\s+(?:engineer|architect)|senior\s+\w[\w\s/&+-]{0,40}|lead\s+\w[\w\s/&+-]{0,40}|staff\s+\w[\w\s/&+-]{0,40}|product\s+manager|project\s+manager|engineering\s+manager|team\s+lead|intern(?:ship)?|associate\s+\w[\w\s/&+-]{0,40})$/i;

const COMPANY_HINT_RE =
  /\b(pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|llc|inc\.?|corp\.?|technologies|solutions|systems|softwares?|consulting|labs?)\b/i;

const DATE_RANGE_RE =
  /^((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}[\/\-]\d{4}|\d{4})\s*[-–—to]+\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}[\/\-]\d{4}|\d{4}|present|current|till\s*date|to\s*date|ongoing|now)$/i;

/** Remove OCR noise, broken TeX-like tokens, image placeholders. */
export function stripArtifactNoise(text: string): string {
  return text
    .replace(ARTIFACT_RE, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Stitch mid-sentence wraps that are NOT bullet-marked (common in two-column PDFs).
 * Only joins when previous line lacks terminal punctuation and next starts lowercase
 * or looks like a hyphenated wrap.
 */
export function stitchPlainWraps(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!out.length) {
      out.push(line);
      continue;
    }
    const prev = out[out.length - 1];
    if (isBulletLine(prev) || isBulletLine(line)) {
      out.push(line);
      continue;
    }
    if (/[.!?:;…]$/.test(prev)) {
      out.push(line);
      continue;
    }
    // Hyphenated wrap: "develop-" + "ment"
    if (/[A-Za-z]-$/.test(prev) && /^[a-z]/.test(line)) {
      out[out.length - 1] = `${prev.slice(0, -1)}${line}`.replace(/\s+/g, ' ');
      continue;
    }
    // Soft wrap: next starts lowercase / connector
    if (/^[a-z(]/.test(line) || /^(and|or|with|for|to|of|in|on|the|a|an)\b/i.test(line)) {
      out[out.length - 1] = `${prev} ${line}`.replace(/\s+/g, ' ').trim();
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * Re-associate orphaned role titles with the nearest preceding company line
 * when PDF layout split them across columns / vertical gaps.
 *
 * Transforms:
 *   Acme Pvt. Ltd.
 *   …noise…
 *   Technical Architect
 *   Jan 2020 - Present
 * into a contiguous block.
 */
export function reassociateOrphanedRoles(lines: string[]): string[] {
  const cleaned = lines.map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const line = cleaned[i];
    const looksCompany =
      COMPANY_HINT_RE.test(line) ||
      (/^[A-Z][\w.&'\s-]{2,60}$/.test(line) &&
        !ROLE_TITLE_RE.test(line) &&
        !DATE_RANGE_RE.test(line) &&
        line.split(/\s+/).length <= 8);

    if (looksCompany) {
      const block: string[] = [line];
      let j = i + 1;
      let foundRole = false;
      let foundDate = false;
      // Look ahead a short window for orphaned role + date
      while (j < cleaned.length && j < i + 8) {
        const next = cleaned[j];
        if (COMPANY_HINT_RE.test(next) && j > i + 1) break;
        if (ROLE_TITLE_RE.test(next) && !foundRole) {
          block.push(next);
          foundRole = true;
          j += 1;
          continue;
        }
        if (DATE_RANGE_RE.test(next) && !foundDate) {
          block.push(next);
          foundDate = true;
          j += 1;
          continue;
        }
        if (isBulletLine(next) || /^[-•*]/.test(next)) {
          block.push(next);
          j += 1;
          continue;
        }
        // Skip short noise between company and role (photo captions, location fragments)
        if (!foundRole && next.length < 40 && !/@/.test(next) && !COMPANY_HINT_RE.test(next)) {
          j += 1;
          continue;
        }
        break;
      }
      if (foundRole || foundDate) {
        out.push(...block);
        i = j;
        continue;
      }
    }
    out.push(line);
    i += 1;
  }
  return out;
}

/** Sanitize a single free-text date into YYYY-MM / YYYY / PRESENT / '' */
export function sanitizeResumeDate(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  const t = raw.trim();
  if (/^(present|current|till\s*date|to\s*date|ongoing|now)$/i.test(t)) {
    return 'PRESENT';
  }
  // Reject impossible calendar days (e.g. 30th Feb) by preferring month/year only
  const dayMonth = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const monthToken = dayMonth[2];
    const year = Number(dayMonth[3]);
    const monthNames: Record<string, number> = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
      apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
      aug: 8, august: 8, sep: 9, sept: 9, september: 9,
      oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
    };
    const m = monthNames[monthToken.toLowerCase()];
    if (m) {
      const daysInMonth = new Date(year, m, 0).getDate();
      if (day < 1 || day > daysInMonth) {
        // Invalid day → month/year only
        const iso = normalizeResumeDateForStorage(`${monthToken} ${year}`);
        return iso || `${String(m).padStart(2, '0')}/${year}`;
      }
    }
  }
  const parsed = parseResumeDate(t);
  if (parsed) return parsed.iso;
  const stored = normalizeResumeDateForStorage(t);
  return stored || t;
}

export function sanitizeWorkExperienceDates(jobs: ParsedWorkExperience[]): ParsedWorkExperience[] {
  return jobs.map((job) => ({
    ...job,
    start_date: sanitizeResumeDate(job.start_date),
    end_date: sanitizeResumeDate(job.end_date),
    description_bullets: job.description_bullets
      .map((b) => stripArtifactNoise(stripBulletMarker(b)))
      .filter(Boolean),
  }));
}

/**
 * Full text sanitation pipeline before section parse / LLM.
 */
export function sanitizeExtractedResumeText(rawText: string): string {
  let text = stripArtifactNoise(rawText || '');
  let lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u0000/g, ' ').trimEnd())
    .filter((l) => l.trim().length > 0);

  lines = reflowBulletWraps(lines);
  lines = stitchPlainWraps(lines);
  lines = reassociateOrphanedRoles(lines);

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Apply date + bullet sanitation on a coerced schema object. */
export function sanitizeParsedResumeSchema(data: ParsedResumeSchema): ParsedResumeSchema {
  return {
    ...data,
    personal_info: {
      ...data.personal_info,
      full_name: stripArtifactNoise(data.personal_info.full_name),
      email: data.personal_info.email.trim(),
      phone: data.personal_info.phone.trim(),
      location: stripArtifactNoise(data.personal_info.location),
      links: data.personal_info.links.map((l) => l.trim()).filter(Boolean),
    },
    summary: stripArtifactNoise(data.summary),
    work_experience: sanitizeWorkExperienceDates(data.work_experience).filter(
      (j) => j.company || j.role_title || j.description_bullets.length,
    ),
    education: data.education
      .map((e) => ({
        degree: stripArtifactNoise(e.degree),
        institution: stripArtifactNoise(e.institution),
        graduation_year: sanitizeResumeDate(e.graduation_year) || e.graduation_year.trim(),
      }))
      .filter((e) => e.degree || e.institution),
    skills: data.skills.map((s) => stripArtifactNoise(s)).filter(Boolean),
    projects: data.projects
      .map((p) => ({
        title: stripArtifactNoise(p.title),
        description: stripArtifactNoise(p.description),
        link: p.link.trim(),
      }))
      .filter((p) => p.title || p.description),
  };
}
