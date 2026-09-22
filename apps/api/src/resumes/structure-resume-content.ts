import type { ResumeContent } from '@careerbridge/shared';
import type { StructuredResumeDraft } from '../ai/ai.types';
import { extractProjectTechnologies, isPageMarkerText } from './parse-extracted-resume';

function pickEmail(raw: string): string | null {
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim() || null;
}

function pickPhone(raw: string): string | null {
  const labeled = raw.match(/(?:mobile|phone|contact|cell)\s*[:\-–]?\s*([+]?\d[\d\s\-()]{7,18}\d)/i);
  if (labeled?.[1]) return labeled[1].replace(/\s+/g, ' ').trim();
  const loose = raw.match(/(?<![\w.])(?:\+?\d{1,3}[\s-]?)?\d{10}(?![\w.])/);
  return loose?.[0]?.replace(/\s+/g, ' ').trim() || null;
}

/** Fill gaps the LLM missed using the Document AI raw text. */
export function enrichResumeContentFromRawText(
  content: ResumeContent,
  rawText: string,
): ResumeContent {
  const text = rawText || '';
  const email = content.email?.trim() || pickEmail(text);
  const phone = content.phone?.trim() || pickPhone(text);

  let city = content.city;
  if (!city?.trim()) {
    const place = text.match(/Place\s*:\s*([A-Za-z .'-]{2,40})/i)?.[1]?.trim();
    const bangalore = /\bBangalore\b|\bBengaluru\b/i.test(text) ? 'Bangalore' : null;
    city = place || bangalore || city;
  }

  const personal = { ...(content.personalDetails || {}) };
  if (!personal.dateOfBirth) {
    const dob =
      text.match(/Date of Birth\s*\n?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)?.[1] ||
      text.match(/DOB\s*[:\-–]?\s*([A-Za-z0-9 ,\/\-]{4,30})/i)?.[1];
    if (dob) personal.dateOfBirth = dob.trim();
  }
  if (!personal.fatherName) {
    const father = text.match(/Father'?s Name\s*\n?\s*([A-Za-z .']{2,60})/i)?.[1];
    if (father) personal.fatherName = father.trim();
  }
  if (!personal.maritalStatus) {
    const marital = text.match(/Marital Status\s*\n?\s*([A-Za-z ]{3,20})/i)?.[1];
    if (marital) personal.maritalStatus = marital.trim();
  }
  if (!personal.permanentAddress) {
    const addrBlock = text.match(
      /Permanent Address\s*\n([\s\S]*?)(?:\nDeclaration|\nPlace:|\nI hereby|$)/i,
    )?.[1];
    if (addrBlock) {
      personal.permanentAddress = addrBlock
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(', ')
        .slice(0, 500);
    }
  }
  if (!personal.place) {
    const place = text.match(/Place\s*:\s*([A-Za-z .'-]{2,40})/i)?.[1]?.trim();
    if (place) personal.place = place;
  }

  return {
    ...content,
    email: email || null,
    phone: phone || null,
    city: city?.trim() || null,
    ...(Object.values(personal).some(Boolean) ? { personalDetails: personal } : {}),
  };
}

/**
 * Convert LLM structured draft → ResumeContent (no heuristic local parser for structure).
 */
export function structuredDraftToResumeContent(draft: StructuredResumeDraft): ResumeContent {
  const fullName =
    [draft.firstName, draft.lastName].filter((part) => String(part || '').trim()).join(' ').trim() ||
    'Candidate';

  const education =
    Array.isArray(draft.education) && draft.education.length
      ? draft.education
          .map((row) => {
            const yearRaw = String(row.yearCompleted || '').trim();
            const year = Number.parseInt(yearRaw.replace(/\D/g, '').slice(0, 4), 10);
            const qualification = [row.qualification, row.fieldOfStudy]
              .map((v) => String(v || '').trim())
              .filter(Boolean)
              .join(' in ');
            return {
              qualification: qualification || String(row.qualification || '').trim(),
              institution: String(row.institution || '').trim() || null,
              yearCompleted: Number.isFinite(year) ? year : null,
            };
          })
          .filter((row) => row.qualification || row.institution)
      : [];

  const experiences =
    Array.isArray(draft.experience) && draft.experience.length
      ? draft.experience
          .map((row) => {
            const endRaw = String(row.endDate || '').trim();
            const isCurrent =
              Boolean(row.isCurrent) ||
              /till\s*date|present|current|ongoing/i.test(endRaw);
            return {
              company: String(row.company || '').trim(),
              jobTitle: String(row.jobTitle || '').trim(),
              description: String(row.description || '').trim() || null,
              isInternship: Boolean(row.isInternship),
              startDate: String(row.startDate || '').trim() || null,
              endDate: isCurrent ? null : endRaw || null,
              isCurrent,
            };
          })
          .filter((row) => row.company || row.jobTitle || row.description)
      : [];

  const projects =
    Array.isArray(draft.projects) && draft.projects.length
      ? draft.projects
          .map((row) => {
            const name = String(row.title || '').trim();
            const rawDescription = String(row.description || '').trim();
            const fromAiTech = Array.isArray(row.technologies)
              ? row.technologies.map((t) => String(t || '').trim()).filter(Boolean)
              : [];
            const role = String(row.role || '').trim();
            const roleAsTech =
              role && /[,|/]/.test(role)
                ? role.split(/[,;/|]+/).map((t) => t.trim()).filter((t) => t.length > 1 && t.length < 48)
                : [];
            const bodyLines = rawDescription
              .split(/\n+/)
              .map((line) => line.trim())
              .filter(Boolean);
            const peeled = extractProjectTechnologies(bodyLines);
            const technologies = Array.from(
              new Set([...peeled.technologies, ...fromAiTech, ...roleAsTech]),
            ).slice(0, 24);
            return {
              name,
              description: peeled.description || null,
              url: String(row.url || '').trim() || null,
              ...(technologies.length ? { technologies } : {}),
            };
          })
          .filter((row) => row.name || row.description)
      : [];

  const skills = Array.isArray(draft.skills)
    ? [...new Set(draft.skills.map((s) => String(s || '').trim()).filter(Boolean))]
    : [];

  const languages = Array.isArray(draft.languages)
    ? draft.languages.map((l) => String(l || '').trim()).filter(Boolean)
    : [];

  const certifications = Array.isArray(draft.certifications)
    ? draft.certifications
        .map((row) => ({
          name: String(row.name || '').trim(),
          issuer: String(row.issuer || '').trim() || null,
          date: String(row.date || '').trim() || null,
        }))
        .filter((row) => row.name)
    : [];

  const achievements = Array.isArray(draft.achievements)
    ? draft.achievements
        .map((row) => ({
          title: String(row.title || '').trim(),
          organization: String(row.organization || '').trim() || null,
          description: String(row.description || '').trim() || null,
          date: String(row.date || '').trim() || null,
        }))
        .filter((row) => row.title && !isPageMarkerText(row.title, row.organization, row.description))
    : [];

  const links = {
    linkedin: String(draft.linkedin || '').trim() || undefined,
    github: String(draft.github || '').trim() || undefined,
    portfolio: String(draft.portfolio || '').trim() || undefined,
    website: String(draft.website || '').trim() || undefined,
  };

  const personalDetails = {
    dateOfBirth: String(draft.dateOfBirth || '').trim() || null,
    fatherName: String(draft.fatherName || '').trim() || null,
    maritalStatus: String(draft.maritalStatus || '').trim() || null,
    gender: String(draft.gender || '').trim() || null,
    permanentAddress: String(draft.permanentAddress || '').trim() || null,
    place: String(draft.place || '').trim() || null,
  };

  return {
    fullName,
    city: String(draft.city || '').trim() || null,
    state: String(draft.state || '').trim() || null,
    phone: String(draft.phone || '').trim() || null,
    email: String(draft.email || '').trim() || null,
    summary: String(draft.about || '').trim() || '',
    skills,
    education,
    experiences,
    languages,
    certifications,
    achievements,
    projects,
    includePhoto: false,
    ...(Object.values(personalDetails).some(Boolean) ? { personalDetails } : {}),
    ...(links.linkedin || links.github || links.portfolio || links.website ? { links } : {}),
  };
}

/** Reject empty / nonsense LLM output before persisting. */
export function validateStructuredResume(content: ResumeContent, rawText: string): string[] {
  const errors: string[] = [];
  const textLen = (rawText || '').trim().length;
  if (textLen < 40) {
    errors.push('Extracted resume text is too short to parse reliably.');
  }

  const hasName = Boolean(content.fullName?.trim() && content.fullName.trim().toLowerCase() !== 'candidate');
  const hasSkills = (content.skills?.length || 0) > 0;
  const hasEducation = (content.education?.length || 0) > 0;
  const hasExperience = (content.experiences?.length || 0) > 0;
  const hasProjects = (content.projects?.length || 0) > 0;
  const hasContact = Boolean(content.email?.trim() || content.phone?.trim());

  if (!hasName && !hasSkills && !hasEducation && !hasExperience && !hasProjects && !hasContact) {
    errors.push(
      'LLM parser returned no usable fields (name, skills, education, experience, projects, or contact).',
    );
  }

  return errors;
}

/** LLM structuring with retries + raw-text enrichment for contact/personal gaps. */
export async function parseResumeTextWithLlm(
  rawText: string,
  structureFn: (text: string) => Promise<StructuredResumeDraft | null>,
  options?: { attempts?: number; delayMs?: number },
): Promise<ResumeContent> {
  const attempts = options?.attempts ?? 4;
  const delayMs = options?.delayMs ?? 2000;
  let lastError: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const structured = await structureFn(rawText);
      if (!structured) {
        throw new Error('LLM resume parser returned empty result.');
      }
      const content = enrichResumeContentFromRawText(
        structuredDraftToResumeContent(structured),
        rawText,
      );
      const validationErrors = validateStructuredResume(content, rawText);
      if (validationErrors.length) {
        throw new Error(validationErrors.join(' '));
      }
      return content;
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('LLM resume parser failed after retries.');
}

/** @deprecated Prefer parseResumeTextWithLlm — kept for any legacy callers. */
export async function parseResumeTextWithOptionalAi(
  rawText: string,
  structureFn: (text: string) => Promise<StructuredResumeDraft | null>,
): Promise<ResumeContent> {
  return parseResumeTextWithLlm(rawText, structureFn, { attempts: 3 });
}
