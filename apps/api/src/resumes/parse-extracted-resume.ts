import { listCityCentroids, type ResumeContent } from '@careerbridge/shared';
import {
  attachPersonalBlock,
  ensureExperienceDateShape,
  splitLocationParts,
} from './resume-extract-normalize';
import { normalizeResumeDateForStorage } from '@careerbridge/shared';
import { reflowBulletWraps } from './bullet-reflow';
import { looksLikePersonalLeakToken, sweepPersonalFromLines } from './pii-sweep';
import { validateAndSanitizeExtracted } from './extract-validate';
import { isCompanyOnlyBullet, looksLikeEmployerBoundary } from './employer-boundary';
import { collapseNearDuplicateExperiences, rescueLateHeadingBody } from './section-rescue';

/**
 * Heuristic resume section parser — heading-alias + semantic boundary driven.
 * Does NOT depend on a single template. Keeps ResumeContent shape for API/ATS/autofill.
 */

type SectionKey =
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'
  | 'certs'
  | 'achievements'
  | 'languages'
  | 'responsibilities'
  | 'personal'
  | 'skip';

const SECTION_ALIASES: Record<string, SectionKey> = {
  SUMMARY: 'summary',
  'PROFESSIONAL SUMMARY': 'summary',
  'CAREER SUMMARY': 'summary',
  'CAREER OBJECTIVE': 'summary',
  OBJECTIVE: 'summary',
  'PROFILE SUMMARY': 'summary',
  PROFILE: 'summary',
  'ABOUT ME': 'summary',
  ABOUT: 'summary',

  EXPERIENCE: 'experience',
  EXPERIENCES: 'experience',
  'WORK EXPERIENCE': 'experience',
  'PROFESSIONAL EXPERIENCE': 'experience',
  'EMPLOYMENT HISTORY': 'experience',
  'CAREER HISTORY': 'experience',
  'WORK HISTORY': 'experience',
  'CAREER EXPERIENCE': 'experience',
  'PROFESSIONAL BACKGROUND': 'experience',
  EMPLOYMENT: 'experience',
  INTERNSHIP: 'experience',
  INTERNSHIPS: 'experience',
  'INTERNSHIPS & EXPERIENCE': 'experience',
  'INTERNSHIPS AND EXPERIENCE': 'experience',

  'TECHNICAL SKILLS': 'skills',
  'TECHNICAL PROFICIENCIES': 'skills',
  'TECHNICAL EXPERTISE': 'skills',
  'RELEVANT SKILLS': 'skills',
  'CORE SKILLS': 'skills',
  'KEY SKILLS': 'skills',
  'SKILLS & TOOLS': 'skills',
  'SKILLS AND TOOLS': 'skills',
  'TOOLS & TECHNOLOGIES': 'skills',
  'TOOLS AND TECHNOLOGIES': 'skills',
  'SKILLS TOOLS': 'skills',
  SKILLS: 'skills',
  'CORE COMPETENCIES': 'skills',
  COMPETENCIES: 'skills',
  EXPERTISE: 'skills',
  TECHNOLOGIES: 'skills',
  'TECHNOLOGY STACK': 'skills',
  TOOLS: 'skills',
  'PROGRAMMING LANGUAGES': 'skills',
  FRAMEWORKS: 'skills',
  LIBRARIES: 'skills',
  DATABASES: 'skills',
  CLOUD: 'skills',
  APIS: 'skills',
  SOFTWARE: 'skills',
  PLATFORMS: 'skills',
  METHODOLOGIES: 'skills',

  'ACADEMIC PROFILE': 'education',
  'ACADEMIC DETAILS': 'education',
  EDUCATION: 'education',
  'EDUCATION HISTORY': 'education',
  'ACADEMIC QUALIFICATION': 'education',
  'ACADEMIC QUALIFICATIONS': 'education',
  'ACADEMIC BACKGROUND': 'education',
  'EDUCATIONAL QUALIFICATION': 'education',
  'EDUCATIONAL QUALIFICATIONS': 'education',
  QUALIFICATIONS: 'education',
  ACADEMICS: 'education',

  PROJECTS: 'projects',
  PROJECT: 'projects',
  'PROJECT DETAILS': 'projects',
  'KEY PROJECTS': 'projects',
  'SELECTED PROJECTS': 'projects',
  'ACADEMIC PROJECTS': 'projects',
  'PERSONAL PROJECTS': 'projects',
  'PROFESSIONAL PROJECTS': 'projects',
  'MAJOR PROJECTS': 'projects',

  ACHIEVEMENTS: 'achievements',
  ACHIEVEMENT: 'achievements',
  'KEY ACHIEVEMENTS': 'achievements',
  ACCOMPLISHMENTS: 'achievements',
  AWARDS: 'achievements',
  HONORS: 'achievements',
  'HONORS & AWARDS': 'achievements',
  RECOGNITION: 'achievements',

  CERTIFICATIONS: 'certs',
  CERTIFICATE: 'certs',
  CERTIFICATES: 'certs',
  'PROFESSIONAL CERTIFICATIONS': 'certs',
  LICENSES: 'certs',
  'LICENSES & CERTIFICATIONS': 'certs',
  'CERTIFICATIONS AND LICENSES': 'certs',
  'ACHIEVEMENTS AND CERTIFICATIONS': 'achievements',
  'ACHIEVEMENTS & CERTIFICATIONS': 'achievements',
  'CERTIFICATIONS AND ACHIEVEMENTS': 'certs',
  'CERTIFICATIONS & ACHIEVEMENTS': 'certs',

  LANGUAGES: 'languages',
  'LANGUAGE PROFICIENCY': 'languages',
  'KNOWN LANGUAGES': 'languages',
  'LANGUAGES KNOWN': 'languages',
  'HUMAN LANGUAGES': 'languages',

  RESPONSIBILITIES: 'responsibilities',
  'ROLE & RESPONSIBILITIES': 'responsibilities',
  'ROLES AND RESPONSIBILITIES': 'responsibilities',
  'ROLE AND RESPONSIBILITIES': 'responsibilities',
  'KEY RESPONSIBILITIES': 'responsibilities',
  'JOB RESPONSIBILITIES': 'responsibilities',
  DUTIES: 'responsibilities',

  CONTACT: 'personal',
  'PERSONAL DETAILS': 'personal',
  'PERSONAL INFORMATION': 'personal',
  'PERSONAL PROFILE': 'personal',
  'CONTACT INFORMATION': 'personal',
  'CONTACT DETAILS': 'personal',

  DECLARATION: 'skip',
  REFERENCES: 'skip',
  REFERENCE: 'skip',
  HOBBIES: 'skip',
  INTERESTS: 'skip',
  'HOBBIES & INTERESTS': 'skip',
};

const PLACEHOLDER_LINES = new Set([
  'your college or university',
  'your name',
  'city, state',
]);

const HUMAN_LANGUAGES = new Set(
  [
    'english',
    'hindi',
    'telugu',
    'tamil',
    'kannada',
    'malayalam',
    'marathi',
    'bengali',
    'gujarati',
    'punjabi',
    'urdu',
    'odia',
    'oriya',
    'assamese',
    'french',
    'german',
    'spanish',
    'chinese',
    'mandarin',
    'japanese',
    'korean',
    'arabic',
    'russian',
    'portuguese',
    'italian',
    'dutch',
    'nepali',
    'sinhala',
    'konkani',
    'sanskrit',
  ].map((s) => s.toLowerCase()),
);

/** High-confidence tech tokens — used to avoid misclassifying programming languages as human languages. */
const TECH_SKILL_HINTS = new Set(
  [
    'java',
    'javascript',
    'typescript',
    'python',
    'c',
    'c++',
    'c#',
    'csharp',
    'swift',
    'kotlin',
    'objective-c',
    'objectivec',
    'golang',
    'go',
    'php',
    'ruby',
    'rust',
    'scala',
    'r',
    'sql',
    'mysql',
    'postgresql',
    'postgres',
    'mongodb',
    'sqlite',
    'oracle',
    'redis',
    'react',
    'angular',
    'vue',
    'node',
    'nodejs',
    'nest',
    'nestjs',
    'express',
    'spring',
    'django',
    'flask',
    'aws',
    'azure',
    'gcp',
    'docker',
    'kubernetes',
    'git',
    'github',
    'gitlab',
    'jenkins',
    'jira',
    'html',
    'css',
    'sass',
    'tailwind',
    'bootstrap',
    'jquery',
    'android',
    'ios',
    'xcode',
    'vscode',
    'visual studio',
    'power bi',
    'powerbi',
    'excel',
    'tableau',
    'spark',
    'hadoop',
    'kafka',
    'graphql',
    'rest',
    'api',
    'apis',
    'jdbc',
    'hibernate',
    'prisma',
    'firebase',
    'webrtc',
    'linux',
    'unix',
    'bash',
    'shell',
    'dotnet',
    '.net',
    'asp.net',
    'servlet',
    'servlets',
    'jsp',
    'maven',
    'gradle',
    'npm',
    'yarn',
    'webpack',
    'nextjs',
    'next.js',
    'nuxt',
    'redux',
    'rxjs',
    'selenium',
    'cypress',
    'junit',
    'pytest',
    'tensorflow',
    'pytorch',
    'pandas',
    'numpy',
    'matlab',
    'sas',
    'splunk',
    'elasticsearch',
    'kibana',
    'figma',
    'photoshop',
    'illustrator',
    'salesforce',
    'sap',
    'wordpress',
    'shopify',
  ].map((s) => s.toLowerCase()),
);

const INDIAN_STATES = [
  'andhra pradesh',
  'arunachal pradesh',
  'assam',
  'bihar',
  'chhattisgarh',
  'goa',
  'gujarat',
  'haryana',
  'himachal pradesh',
  'jharkhand',
  'karnataka',
  'kerala',
  'madhya pradesh',
  'maharashtra',
  'manipur',
  'meghalaya',
  'mizoram',
  'nagaland',
  'odisha',
  'punjab',
  'rajasthan',
  'sikkim',
  'tamil nadu',
  'telangana',
  'tripura',
  'uttar pradesh',
  'uttarakhand',
  'west bengal',
  'delhi',
  'nct of delhi',
  'jammu and kashmir',
  'ladakh',
  'puducherry',
  'chandigarh',
];

const CITY_NAMES = listCityCentroids().map((c) => c.name.toLowerCase());

const PERSONAL_LEAK_LABELS =
  /^(?:(?:father\s*['’]?\s*s?\s*name|mother\s*['’]?\s*s?\s*name|gender|date\s*of\s*birth|d\.?o\.?b\.?|nationality|marital\s*status|blood\s*group|passport|aadhaar|pan|religion|address|place|permanent\s*address|present\s*address)\b|name\s*[:|\-–])/i;

const DEGREE_PATTERN =
  /\b(b\.?\s*tech|m\.?\s*tech|b\.?\s*e\.?\b|m\.?\s*e\.?\b|bca|mca|bba|mba|b\.?\s*sc|m\.?\s*sc|b\.?\s*com|m\.?\s*com|b\.?\s*a\.?\b|m\.?\s*a\.?\b|phd|ph\.?\s*d|diploma|puc|intermediate|hsc|ssc|10th|12th|bachelor|master|graduate|post[\s-]?graduate)\b/i;

const DATE_RANGE_PATTERN =
  /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|(?:19|20)\d{2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?|\d{1,2}[\/\-](?:\d{1,2}[\/\-])?(?:19|20)\d{2}|(?:19|20)\d{2})\s*(?:[-–—]|to)?\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|(?:19|20)\d{2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?|\d{1,2}[\/\-](?:\d{1,2}[\/\-])?(?:19|20)\d{2}|(?:19|20)\d{2}|present|current|till\s*date|to\s*date|ongoing)\b/i;

function debugLog(stage: string, payload: unknown) {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.RESUME_PARSE_DEBUG !== '1' && process.env.NODE_ENV !== 'development') return;
  try {
    // Avoid dumping full resume text unless explicitly requested.
    const safe =
      typeof payload === 'string'
        ? payload.slice(0, 500)
        : JSON.parse(JSON.stringify(payload, (_k, v) => (typeof v === 'string' && v.length > 400 ? `${v.slice(0, 400)}…` : v)));
    // eslint-disable-next-line no-console
    console.debug(`[resume-parse] ${stage}`, safe);
  } catch {
    // ignore
  }
}

function headingKey(line: string): SectionKey | null {
  const trimmed = line.trim();
  // Tab/cell content on the same line means this is a table row, not a section heading.
  if (trimmed.includes('\t') && trimmed.split(/\t+/).length > 1) return null;
  // Labeled skill/language rows with inline values are content, not section starts.
  if (
    /^(languages?(?:\s+known)?|known\s+languages?|skills?|tools?|technologies?|core\s+competencies)\s*[:|\-–]\s*\S+/i.test(
      trimmed,
    )
  ) {
    return null;
  }

  const key = trimmed
    .replace(/[:\s]+$/g, '')
    .replace(/[•·|_/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!key || key.length > 60) return null;
  // Headings are usually short / title-like
  if (key.split(' ').length > 8) return null;

  if (SECTION_ALIASES[key]) return SECTION_ALIASES[key];

  if (/^TECHNICAL SKILL|^SKILL\b|^CORE COMPETEN|^TECHNOLOG|^TOOLS?\b|^FRAMEWORK|^DATABASE|^PROGRAMMING/.test(key)) {
    return 'skills';
  }
  if (/^WORK EXPER|^PROFESSIONAL EXPER|^EMPLOYMENT|^CAREER HIST|^WORK HIST|^PROFESSIONAL BACK/.test(key)) {
    return 'experience';
  }
  // Bare "JOB PROFILE" can be a section heading; "Job Profile in Acme Pvt. Ltd." is an employer line.
  if (/^JOB PROFILE$/.test(key)) return 'experience';
  if (/^CERTIFIC|^LICENSE/.test(key)) return 'certs';
  if (/^ACHIEV|^ACCOMPLISH|^AWARD|^HONOR|^RECOGNITION/.test(key)) return 'achievements';
  if (/^PROJECT/.test(key)) return 'projects';
  if (/^EDUCAT|^ACADEMIC|^QUALIFICATION/.test(key)) return 'education';
  if (/^LANGUAGE/.test(key)) return 'languages';
  if (/^SUMMARY|^OBJECTIVE|^CAREER OBJECTIVE|^PROFILE$|^ABOUT/.test(key)) return 'summary';
  // "Responsibilities:" is usually a job subheading, not a top-level section switch.
  // Only treat bare RESPONSIBILITIES as a section when it is the entire heading.
  if (/^(ROLE\s*[&AND]*\s*RESPONSIBILITIES|KEY RESPONSIBILITIES|JOB RESPONSIBILITIES|DUTIES)$/.test(key)) {
    return 'responsibilities';
  }
  if (/^RESPONSIBILITIES$/.test(key)) return 'responsibilities';
  if (/^PERSONAL\b|^CONTACT\b/.test(key)) return 'personal';
  if (/^DECLARATION|^REFERENCE|^HOBB|^INTEREST/.test(key)) return 'skip';
  return null;
}

function looksLikePageMarker(line: string) {
  const cleaned = line
    .trim()
    .replace(/[-–—•|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return false;
  if (/^(page\s+)?\d+\s*of\s*\d+$/i.test(cleaned.replace(/\s+/g, ''))) return true;
  if (/^(page\s+)?\d+\s+of\s+\d+$/i.test(cleaned)) return true;
  if (/^page\s+\d+$/i.test(cleaned)) return true;
  return false;
}

export function isPageMarkerText(...parts: Array<string | null | undefined>) {
  const blob = parts.filter(Boolean).join(' ').trim();
  if (!blob) return false;
  return looksLikePageMarker(blob);
}

export function extractProjectTechnologies(body: string[]): {
  description: string | null;
  technologies: string[];
} {
  const techLabel =
    /^(?:technologies?|tech\s*stack|tools?(?:\s+used)?|stack)\s*[:|\-–—]\s*(.+)$/i;
  const techTrailing =
    /^(.*?)(?:\s+)(?:technologies?|tech\s*stack|tools?(?:\s+used)?|stack)\s*[:|\-–—]\s*(.+)$/i;
  const splitTokens = (raw: string) =>
    raw
      .split(/[,;/|•]+/)
      .map((item) => item.replace(/\.$/, '').trim())
      .filter((item) => item.length > 1 && item.length < 48);

  const found: string[] = [];
  const kept: string[] = [];
  for (const row of body) {
    const labeled = row.match(techLabel);
    if (labeled?.[1]) {
      found.push(...splitTokens(labeled[1]));
      continue;
    }
    const trailing = row.match(techTrailing);
    if (trailing?.[2] && splitTokens(trailing[2]).length > 0) {
      if (trailing[1]?.trim()) kept.push(trailing[1].trim());
      found.push(...splitTokens(trailing[2]));
      continue;
    }
    kept.push(row);
  }

  let description = kept.join('\n').trim();
  const endMatch = description.match(
    /\b(?:technologies?|tech\s*stack|tools?(?:\s+used)?|stack)\s*[:|\-–—]\s*([^.]+)$/i,
  );
  if (endMatch?.[1] && splitTokens(endMatch[1]).length > 0) {
    found.push(...splitTokens(endMatch[1]));
    description = description.slice(0, endMatch.index).trim().replace(/[.,;:\s]+$/, '');
  }

  return {
    description: description || null,
    technologies: [...new Set(found)],
  };
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
}

function cleanCapturedUrl(raw: string) {
  return raw.replace(/[),.;\]}>]+$/g, '').trim();
}

function ensureHttps(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

/** Pull LinkedIn / GitHub / other profile URLs from resume text. */
export function extractProfileLinksFromText(rawText: string): NonNullable<ResumeContent['links']> {
  const text = rawText.replace(/\u0000/g, ' ');
  const urls = Array.from(
    text.matchAll(
      /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[^\s)\]>,]+|github\.com\/[^\s)\]>,]+|(?:portfolio|behance|dribbble|notion\.site|vercel\.app|netlify\.app|github\.io)[^\s)\]>,]*)/gi,
    ),
  ).map((m) => cleanCapturedUrl(m[0]));

  let linkedin: string | undefined;
  let github: string | undefined;
  let portfolio: string | undefined;

  for (const url of urls) {
    const lower = url.toLowerCase();
    if (!linkedin && lower.includes('linkedin.com')) {
      linkedin = ensureHttps(url);
      continue;
    }
    if (!github && lower.includes('github.com') && !lower.includes('github.io')) {
      github = ensureHttps(url);
      continue;
    }
    if (!portfolio && !lower.includes('linkedin.com') && !lower.includes('github.com')) {
      portfolio = ensureHttps(url);
    }
  }

  if (!linkedin) {
    const labeled = text.match(/linkedin\s*[:|\-–]\s*(\S+)/i)?.[1];
    if (labeled && /linkedin\.com/i.test(labeled)) linkedin = ensureHttps(cleanCapturedUrl(labeled));
  }
  if (!github) {
    const labeled = text.match(/github\s*[:|\-–]\s*(\S+)/i)?.[1];
    if (labeled && /github\.com/i.test(labeled)) github = ensureHttps(cleanCapturedUrl(labeled));
  }

  return {
    ...(linkedin ? { linkedin } : {}),
    ...(github ? { github } : {}),
    ...(portfolio ? { portfolio } : {}),
  };
}

function extractPhone(text: string) {
  const match =
    text.match(/(\+?\s*91[\s-]?)?[6-9]\d{9}/) ||
    text.match(/(\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 10) return digits;
  return match[0].trim();
}

function looksLikeLocationFragment(raw: string) {
  const text = raw.trim();
  if (!text || text.length > 80) return false;
  if (text.includes('@') || /https?:\/\//i.test(text)) return false;
  if (/^\+?\d[\d\s()-]{7,}$/.test(text)) return false;
  const lower = text.toLowerCase();
  if (CITY_NAMES.some((c) => lower.includes(c))) return true;
  if (INDIAN_STATES.some((s) => lower.includes(s))) return true;
  // City, State / City - State
  if (/^[A-Za-z][A-Za-z.\s]{1,30},\s*[A-Za-z][A-Za-z.\s]{1,30}$/.test(text)) return true;
  return false;
}

function extractLocationFromText(sources: string[]): string | null {
  const labeled = sources
    .map((s) => s.match(/\b(?:location|address|place|city|based\s+in)\s*[:|\-–]\s*(.+)$/i)?.[1]?.trim())
    .find((v) => v && looksLikeLocationFragment(v));
  if (labeled) return labeled;

  for (const src of sources) {
    const parts = src.split(/[|•]/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (looksLikeLocationFragment(part)) return part;
    }
  }

  for (const src of sources) {
    for (const city of CITY_NAMES) {
      const re = new RegExp(`\\b${city.replace(/\s+/g, '\\s+')}\\b(?:\\s*,\\s*([A-Za-z][A-Za-z\\s]{2,30}))?`, 'i');
      const m = src.match(re);
      if (m) {
        const state = m[1]?.trim();
        const cityName = listCityCentroids().find((c) => c.name.toLowerCase() === city)?.name || m[0].split(',')[0].trim();
        if (state && INDIAN_STATES.some((s) => state.toLowerCase().includes(s) || s.includes(state.toLowerCase()))) {
          return `${cityName}, ${state}`;
        }
        // Prefer "City, State" if present on the same line
        const cityState = src.match(
          new RegExp(`\\b${city.replace(/\s+/g, '\\s+')}\\s*,\\s*[A-Za-z][A-Za-z\\s]{2,30}`, 'i'),
        );
        if (cityState) return cityState[0].replace(/\s+/g, ' ').trim();
        return cityName;
      }
    }
  }
  return null;
}

function extractCity(contactLine: string, email: string | null, phone: string | null, extraSources: string[] = []) {
  const cleaned = contactLine
    .split('|')
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      if (email && part.includes(email)) return false;
      if (phone && part.replace(/\D/g, '').includes(phone.replace(/\D/g, '').slice(-10))) return false;
      return true;
    })
    .join(', ');

  const fromCleaned = cleaned && looksLikeLocationFragment(cleaned) ? cleaned : null;
  return (
    fromCleaned ||
    extractLocationFromText([contactLine, cleaned, ...extraSources].filter(Boolean)) ||
    null
  );
}

function isShortLabel(line: string) {
  const trimmed = line.trim();
  if (trimmed.length > 70 || trimmed.split(/\s+/).length > 10) return false;
  // Allow trailing abbreviation dots (Ltd., Inc., Pvt.) but not sentence endings.
  if (/[.!?]$/.test(trimmed) && !/\b(pvt|ltd|llc|inc|corp|co|jr|sr|phd|m\.?tech|b\.?tech)\.?$/i.test(trimmed)) {
    return false;
  }
  return true;
}

function isBullet(line: string) {
  return /^[-•*▪◦●]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
}

function stripBullet(line: string) {
  return line.replace(/^[-•*▪◦●]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
}

function parseDateRange(line: string): { startDate?: string; endDate?: string; isCurrent?: boolean } | null {
  const m = line.match(DATE_RANGE_PATTERN);
  if (!m) return null;
  const startRaw = m[1].replace(/\s+/g, ' ').trim();
  const endRaw = m[2].replace(/\s+/g, ' ').trim();
  const isCurrent = /present|current|till\s*date|to\s*date|ongoing/i.test(endRaw);
  return {
    startDate: normalizeResumeDateForStorage(startRaw) || startRaw,
    endDate: isCurrent ? undefined : normalizeResumeDateForStorage(endRaw) || endRaw,
    isCurrent,
  };
}

function looksLikeAchievementBullet(line: string) {
  return /\b(award|awarded|recognized|recognition|won|employee of|certificate of|achieved|reduced .+ by \d+|increased .+ by \d+|improved .+ by \d+)\b/i.test(
    line,
  );
}

/** True company signals — not every short label. */
function looksLikeCompany(line: string) {
  const bare = stripBullet(line);
  if (!isShortLabel(bare) || isBullet(bare)) return false;
  if (DEGREE_PATTERN.test(bare)) return false;
  if (DATE_RANGE_PATTERN.test(bare) && bare.length < 40) return false;
  if (looksLikeJobTitle(bare)) return false;
  return /\b(pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|llc|inc\.?|corp\.?|technologies|solutions|systems|softwares?|labs?|studios?|consulting|services|company|group|india|global)\b/i.test(
    bare,
  );
}

function looksLikeJobTitle(line: string) {
  const bare = stripBullet(line);
  if (!isShortLabel(bare)) return false;
  return /\b(engineer|developer|manager|analyst|consultant|architect|lead|intern|founder|ceo|cto|director|associate|specialist|designer|tester|qa|executive|officer|administrator|programmer|scientist|trainee|coordinator|recruiter|owner)\b/i.test(
    bare,
  );
}

function looksLikeExperienceHeaderPair(a: string, b: string) {
  if (!isShortLabel(a) || !isShortLabel(b) || isBullet(a) || isBullet(b)) return false;
  if (parseDateRange(a) && !looksLikeJobTitle(a) && !looksLikeCompany(a)) return false;
  return (
    (looksLikeJobTitle(a) && (looksLikeCompany(b) || isShortLabel(b))) ||
    (looksLikeCompany(a) && looksLikeJobTitle(b)) ||
    (looksLikeJobTitle(a) && looksLikeJobTitle(b) === false && !parseDateRange(b))
  );
}

const PROSE_JOB_PATTERN =
  /(?:^|[•\-\u2022]\s*)(?:worked|working)\s+as\s+(.+?)\s+at\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+?)(?:\.|$)/i;

const PROSE_JOB_NO_AT_PATTERN =
  /(?:^|[•\-\u2022]\s*)(?:worked|working)\s+as\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+?)(?:\.|$)/i;

function parseProseEmploymentLine(line: string): ResumeContent['experiences'][number] | null {
  const cleaned = stripBullet(line).replace(/\s+/g, ' ').trim();
  if (/^worked on technologies\b/i.test(cleaned)) return null;
  let m = cleaned.match(PROSE_JOB_PATTERN);
  if (m) {
    let jobTitle = m[1].trim().replace(/\s+/g, ' ').replace(/^an\s+/i, '');
    const company = m[2].trim().replace(/\s+/g, ' ');
    const startRaw = m[3].trim();
    const endRaw = m[4].trim();
    const isCurrent = /present|current|till\s*date|to\s*date|ongoing/i.test(endRaw);
    return {
      jobTitle,
      company,
      description: null,
      isInternship: /intern/i.test(jobTitle),
      startDate: normalizeResumeDateForStorage(startRaw) || startRaw,
      endDate: isCurrent ? null : normalizeResumeDateForStorage(endRaw) || endRaw,
      isCurrent,
      responsibilities: [],
    };
  }
  m = cleaned.match(PROSE_JOB_NO_AT_PATTERN);
  if (m) {
    // Prefer lines with company ("at X"); skip weak no-company duplicates unless unique.
    let jobTitle = m[1].trim().replace(/^an\s+/i, '');
    if (/^worked on technologies\b/i.test(jobTitle)) return null;
    const startRaw = m[2].trim();
    const endRaw = m[3].trim();
    const isCurrent = /present|current|till\s*date|to\s*date|ongoing/i.test(endRaw);
    return {
      jobTitle,
      company: '',
      description: null,
      isInternship: /intern/i.test(jobTitle),
      startDate: normalizeResumeDateForStorage(startRaw) || startRaw,
      endDate: isCurrent ? null : normalizeResumeDateForStorage(endRaw) || endRaw,
      isCurrent,
      responsibilities: [],
    };
  }
  return null;
}

/** Extract "Worked as X at Y from A to B" jobs from any lines (handles bad PDF order). */
function extractProseExperiences(lines: string[]): ResumeContent['experiences'] {
  const jobs: ResumeContent['experiences'] = [];
  for (const line of lines) {
    const job = parseProseEmploymentLine(line);
    if (!job) continue;
    if (/technologies like|full stack development/i.test(job.jobTitle)) continue;
    const key = `${(job.jobTitle || '').replace(/^an\s+/i, '')}|${job.startDate}|${job.endDate}|${job.isCurrent}`.toLowerCase();
    const existingIdx = jobs.findIndex(
      (j) =>
        `${(j.jobTitle || '').replace(/^an\s+/i, '')}|${j.startDate}|${j.endDate}|${j.isCurrent}`.toLowerCase() === key,
    );
    if (existingIdx >= 0) {
      // Prefer the row that has a company name.
      if (!jobs[existingIdx].company && job.company) jobs[existingIdx].company = job.company;
      continue;
    }
    jobs.push(job);
  }
  // Drop no-company rows when a company row exists for same title+dates.
  return jobs.filter((j, _i, arr) => {
    if (j.company) return true;
    return !arr.some(
      (o) =>
        o !== j &&
        o.company &&
        o.jobTitle.replace(/^an\s+/i, '').toLowerCase() === j.jobTitle.replace(/^an\s+/i, '').toLowerCase() &&
        o.startDate === j.startDate,
    );
  });
}

function joinWrappedProseJobLines(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    let cur = stripBullet(lines[i]);
    // Company name wrapped before "from"
    if (
      /(?:worked|working)\s+as\s+.+\s+at\s+\S+/i.test(cur) &&
      !/\bfrom\b/i.test(cur) &&
      lines[i + 1] &&
      /\bfrom\b/i.test(lines[i + 1])
    ) {
      cur = `${cur} ${stripBullet(lines[i + 1])}`.replace(/\s+/g, ' ');
      i += 1;
    }
    // "... from" alone at end — pull following month/year (+ optional "to …") lines
    if (
      /(?:worked|working)\s+as\b.+\bfrom\s*$/i.test(cur) &&
      lines[i + 1] &&
      /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|(?:19|20)\d{2})/i.test(stripBullet(lines[i + 1]))
    ) {
      cur = `${cur} ${stripBullet(lines[i + 1])}`.replace(/\s+/g, ' ');
      i += 1;
      if (
        lines[i + 1] &&
        /^to\s+(?:present|current|till\s*date|to\s*date|ongoing|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(?:19|20)\d{2})/i.test(
          stripBullet(lines[i + 1]),
        )
      ) {
        cur = `${cur} ${stripBullet(lines[i + 1])}`.replace(/\s+/g, ' ');
        i += 1;
      }
    }
    // "from 2020" + next line "October to April 2022"
    if (
      /\bfrom\s+(?:19|20)\d{2}\s*$/i.test(cur) &&
      lines[i + 1] &&
      /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(stripBullet(lines[i + 1]))
    ) {
      cur = `${cur} ${stripBullet(lines[i + 1])}`.replace(/\s+/g, ' ');
      i += 1;
    }
    // "from June 2023" + next "to till date" / "to Present"
    if (
      /\bfrom\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\s*$/i.test(cur) &&
      lines[i + 1] &&
      /^to\s+(?:present|current|till\s*date|to\s*date|ongoing|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i.test(
        stripBullet(lines[i + 1]),
      )
    ) {
      cur = `${cur} ${stripBullet(lines[i + 1])}`.replace(/\s+/g, ' ');
      i += 1;
    }
    // Month Year end date on next line when "to" is missing
    if (
      /\bfrom\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\s*$/i.test(cur) &&
      lines[i + 1] &&
      /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}/i.test(stripBullet(lines[i + 1]))
    ) {
      cur = `${cur} to ${stripBullet(lines[i + 1])}`.replace(/\s+/g, ' ');
      i += 1;
    }
    out.push(cur);
  }
  return out;
}

function stripTrailingDatesFromTitle(title: string): { title: string; dates: ReturnType<typeof parseDateRange> } {
  const dates = parseDateRange(title);
  if (!dates) return { title: title.trim(), dates: null };
  const cleaned = title
    .replace(DATE_RANGE_PATTERN, '')
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\s*(?:present|current)?\b/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { title: cleaned || title.trim(), dates };
}

function isJunkName(line: string) {
  return /^(curriculum\s*vitae|resume|cv|biodata|bio[\s-]?data)$/i.test(line.trim());
}

function isJunkCity(value: string | null | undefined) {
  if (!value) return true;
  if (value.length > 60) return true;
  if (/\b(deadline|corporate|goals|maximize|guiding|utilizing|linkedin|github)\b/i.test(value)) return true;
  if (/^(within|seeking|analytical)\b/i.test(value)) return true;
  return false;
}

function splitHumanLanguageList(raw: string): string[] {
  const cleaned = raw
    .replace(/^(languages?(?:\s+known)?|known\s+languages?)\s*[:|\-–]?\s*/i, '')
    .trim();
  const parts = cleaned.includes(',') || /\band\b/i.test(cleaned)
    ? cleaned.split(/[,;/|]+|\band\b/i)
    : cleaned.split(/\s+/);
  return parts
    .map((s) => String(s || '').trim())
    .filter((s) => s.length > 1 && HUMAN_LANGUAGES.has(s.toLowerCase()));
}

function looksLikeAddressFragment(line: string) {
  return /\b(\d+\s*(st|nd|rd|th)?\s*cross|main\b|nagar|layout|sector|permanent\s*address|pin\b|#\d)/i.test(line);
}

function crossValidateContent(content: ResumeContent): ResumeContent {
  const skills = (content.skills || []).filter(
    (s) => !PERSONAL_LEAK_LABELS.test(s) && !looksLikeAddressFragment(s) && !/father|dob|marital|gender|nationality/i.test(s),
  );
  let languages = (content.languages || []).flatMap((l) => {
    if (l.includes(' ') && !HUMAN_LANGUAGES.has(l.toLowerCase())) {
      const split = splitHumanLanguageList(l);
      if (split.length) return split;
    }
    return [l];
  });
  languages = languages.filter(
    (l) => HUMAN_LANGUAGES.has(l.toLowerCase()) && !looksLikeAddressFragment(l) && !TECH_SKILL_HINTS.has(l.toLowerCase()),
  );
  const experiences = (content.experiences || []).map((e) => {
    const stripped = stripTrailingDatesFromTitle(e.jobTitle || '');
    return {
      ...e,
      jobTitle: stripped.title,
      startDate: e.startDate || stripped.dates?.startDate || null,
      endDate: e.isCurrent ? null : e.endDate || stripped.dates?.endDate || null,
      isCurrent: e.isCurrent || Boolean(stripped.dates?.isCurrent),
    };
  });
  return { ...content, skills, languages, experiences };
}

function mergeExperienceLists(
  primary: ResumeContent['experiences'],
  secondary: ResumeContent['experiences'],
): ResumeContent['experiences'] {
  const out = [...primary];
  for (const job of secondary) {
    const key = `${job.company}|${job.jobTitle}|${job.startDate}`.toLowerCase();
    const existing = out.findIndex((j) => `${j.company}|${j.jobTitle}|${j.startDate}`.toLowerCase() === key);
    if (existing >= 0) {
      const cur = out[existing];
      out[existing] = {
        ...cur,
        company: cur.company || job.company,
        jobTitle: cur.jobTitle || job.jobTitle,
        startDate: cur.startDate || job.startDate,
        endDate: cur.isCurrent || job.isCurrent ? null : cur.endDate || job.endDate,
        isCurrent: cur.isCurrent || job.isCurrent,
        responsibilities: [...(cur.responsibilities || []), ...(job.responsibilities || [])],
        description: cur.description || job.description,
      };
      continue;
    }
    // Prefer richer company match by title+dates
    const byTitle = out.find(
      (j) =>
        j.jobTitle.toLowerCase() === job.jobTitle.toLowerCase() &&
        (!j.company || !job.company || j.company.toLowerCase().includes(job.company.toLowerCase().slice(0, 8))),
    );
    if (byTitle && !byTitle.company && job.company) {
      byTitle.company = job.company;
      continue;
    }
    out.push(job);
  }
  return out;
}

function parseExperience(lines: string[]): ResumeContent['experiences'] {
  if (!lines.length) return [];
  // Prefer prose multi-employer lines when present (common in recruiter CVs / bad PDF order).
  const prose = extractProseExperiences(joinWrappedProseJobLines(lines));
  if (prose.length >= 2) {
    // Attach following responsibility bullets to nearest prior job when "Responsibilities:" blocks appear.
    const withResp = [...prose];
    let jobIdx = -1;
    for (let li = 0; li < lines.length; li += 1) {
      const line = lines[li];
      const proseHit = parseProseEmploymentLine(stripBullet(line));
      if (proseHit) {
        jobIdx = withResp.findIndex(
          (j) =>
            j.jobTitle.toLowerCase() === proseHit.jobTitle.toLowerCase() &&
            (j.company || '') === (proseHit.company || ''),
        );
        continue;
      }
      if (/^responsibilities\s*:?\s*$/i.test(stripBullet(line))) continue;
      if (jobIdx >= 0 && isBullet(line)) {
        const text = stripBullet(line);
        if (!text || PERSONAL_LEAK_LABELS.test(text)) continue;
        // Plan C: company-only / employer-boundary bullets are not responsibilities
        if (isCompanyOnlyBullet(line) || looksLikeEmployerBoundary(line, lines[li + 1])) {
          continue;
        }
        withResp[jobIdx].responsibilities = [...(withResp[jobIdx].responsibilities || []), text];
        withResp[jobIdx].description = [...(withResp[jobIdx].responsibilities || [])].join('\n');
      }
    }
    return withResp;
  }

  const jobs: ResumeContent['experiences'] = [];
  let i = 0;

  const flushJob = (job: {
    jobTitle: string;
    company: string;
    bullets: string[];
    startDate?: string | null;
    endDate?: string | null;
    isCurrent?: boolean;
  }) => {
    if (!job.jobTitle && !job.company && !job.bullets.length) return;
    jobs.push({
      jobTitle: job.jobTitle || (job.company ? 'Role' : lines[0] || 'Role'),
      company: job.company || '',
      description: job.bullets.length ? job.bullets.join('\n') : null,
      isInternship: /intern/i.test(job.jobTitle),
      ...(job.startDate ? { startDate: job.startDate } : {}),
      ...(job.isCurrent ? { isCurrent: true, endDate: null } : job.endDate ? { endDate: job.endDate } : {}),
      ...(job.bullets.length
        ? {
            responsibilities: job.bullets.filter((b) => !looksLikeAchievementBullet(b)),
            achievements: job.bullets.filter((b) => looksLikeAchievementBullet(b)),
          }
        : {}),
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];
    const third = lines[i + 2];
    const datesOnLine = parseDateRange(line);
    const datesOnNext = next ? parseDateRange(next) : null;

    // Pattern: Title \n Company \n Dates  OR  Company \n Title \n Dates
    if (next && looksLikeExperienceHeaderPair(line, next)) {
      let jobTitle = line;
      let company = next;
      let dateMeta = datesOnNext || (third ? parseDateRange(third) : null);
      let consumed = 2;

      if (looksLikeCompany(line) && looksLikeJobTitle(next)) {
        company = line;
        jobTitle = next;
      } else if (looksLikeJobTitle(line) && !looksLikeCompany(next) && !looksLikeJobTitle(next)) {
        // Title + plain company name (e.g. Modasta)
        company = next;
        jobTitle = line;
      }

      if (!dateMeta) {
        const embedded = parseDateRange(company);
        if (embedded) {
          dateMeta = embedded;
          company = company.replace(DATE_RANGE_PATTERN, '').replace(/[|•\-–—]+\s*$/, '').trim();
        }
      }

      if (third && parseDateRange(third)) {
        dateMeta = parseDateRange(third) || dateMeta;
        consumed = 3;
      } else if (
        dateMeta &&
        third &&
        /^[A-Za-z].*,\s*[A-Za-z]/.test(third) &&
        !isBullet(third) &&
        third.length < 50
      ) {
        consumed = 3; // location line after dates-on-company
      }

      i += consumed;

      const bullets: string[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const following = lines[i + 1];
        if (following && looksLikeExperienceHeaderPair(cur, following)) break;
        // Plan C: new employer boundary even when bullet-prefixed
        if (bullets.length > 0 && looksLikeEmployerBoundary(cur, following)) break;
        if (!isBullet(cur) && isShortLabel(cur) && parseDateRange(cur) && bullets.length > 0) break;
        // Title + date on next without company
        if (
          looksLikeJobTitle(stripBullet(cur)) &&
          following &&
          parseDateRange(following) &&
          bullets.length > 0
        ) {
          break;
        }
        if (isCompanyOnlyBullet(cur)) {
        i += 1;
          continue;
        }
        bullets.push(stripBullet(cur));
        i += 1;
      }

      flushJob({
        jobTitle,
        company,
        bullets,
        startDate: dateMeta?.startDate,
        endDate: dateMeta?.endDate,
        isCurrent: dateMeta?.isCurrent,
      });
      continue;
    }

    // Pattern: bullet-prefixed title/company that starts a new job (plan C)
    if (isBullet(line) && looksLikeEmployerBoundary(line, next)) {
      const bare = stripBullet(line);
      let jobTitle = bare;
      let company = '';
      let dateMeta = parseDateRange(bare);
      let consumed = 1;
      if (dateMeta) {
        jobTitle = bare.replace(DATE_RANGE_PATTERN, '').replace(/[|•\-–—]+\s*$/, '').trim() || bare;
      }
      if (next && looksLikeCompany(stripBullet(next)) && !looksLikeJobTitle(stripBullet(next))) {
        company = stripBullet(next);
        consumed = 2;
        if (third && parseDateRange(third)) {
          dateMeta = parseDateRange(third) || dateMeta;
          consumed = 3;
        }
      } else if (next && parseDateRange(next)) {
        dateMeta = parseDateRange(next) || dateMeta;
        consumed = 2;
      }
      i += consumed;
      const bullets: string[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const following = lines[i + 1];
        if (looksLikeEmployerBoundary(cur, following)) break;
        if (following && looksLikeExperienceHeaderPair(cur, following)) break;
        if (isCompanyOnlyBullet(cur)) {
          i += 1;
          continue;
        }
        bullets.push(stripBullet(cur));
        i += 1;
      }
      flushJob({
        jobTitle: looksLikeCompany(jobTitle) && !looksLikeJobTitle(jobTitle) ? 'Role' : jobTitle,
        company: company || (looksLikeCompany(jobTitle) ? jobTitle : ''),
        bullets,
        startDate: dateMeta?.startDate,
        endDate: dateMeta?.endDate,
        isCurrent: dateMeta?.isCurrent,
      });
      continue;
    }

    // Pattern: single line with title/company and dates
    if (datesOnLine && isShortLabel(line)) {
      const withoutDates = line.replace(DATE_RANGE_PATTERN, '').replace(/[|•\-–—]+\s*$/, '').trim();
      const bullets: string[] = [];
      i += 1;
      while (i < lines.length) {
        const cur = lines[i];
        const following = lines[i + 1];
        if (following && looksLikeExperienceHeaderPair(cur, following)) break;
        if (bullets.length > 0 && looksLikeEmployerBoundary(cur, following)) break;
        if (looksLikeJobTitle(stripBullet(cur)) && following && parseDateRange(following)) break;
        if (isCompanyOnlyBullet(cur)) {
          i += 1;
          continue;
        }
        bullets.push(stripBullet(cur));
        i += 1;
      }
      flushJob({
        jobTitle: withoutDates || line,
        company: '',
        bullets,
        startDate: datesOnLine.startDate,
        endDate: datesOnLine.endDate,
        isCurrent: datesOnLine.isCurrent,
      });
      continue;
    }

    // Fallback: take this line as a weak job header, but only collect bullets until the
    // next employer boundary — then continue so later jobs are re-evaluated (plan bug 4).
    const fallbackTitle = stripBullet(line);
    i += 1;
    const bullets: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      const following = lines[i + 1];
      if (following && looksLikeExperienceHeaderPair(cur, following)) break;
      if (looksLikeEmployerBoundary(cur, following)) break;
      if (isCompanyOnlyBullet(cur)) {
        i += 1;
        continue;
      }
      bullets.push(stripBullet(cur));
      i += 1;
    }
    flushJob({
      jobTitle: fallbackTitle,
      company: '',
      bullets,
    });
    continue;
  }

  return jobs;
}

function parseEducation(lines: string[]): ResumeContent['education'] {
  const useful = lines.filter((line) => !PLACEHOLDER_LINES.has(line.toLowerCase()));
  if (!useful.length) return [];

  const entries: ResumeContent['education'] = [];
  let block: string[] = [];

  const flush = () => {
    if (!block.length) return;
    const yearLine = block.find((line) => /\b(19|20)\d{2}\b/.test(line));
    const yearMatch = yearLine?.match(/\b((?:19|20)\d{2})\b/);
    const institution =
      [...block].reverse().find((line) =>
        /university|college|institute|school|academy|vidyalaya|polytechnic|\biit\b|\bnit\b/i.test(line),
      ) ||
      block.find((line, idx) => idx > 0 && !DEGREE_PATTERN.test(line) && !/^\d{4}$/.test(line)) ||
      null;
    const qualification =
      block.find((line) => DEGREE_PATTERN.test(line)) ||
      block.find((line) =>
        /graduate|bachelor|master|information|engineering|degree|computer|science|commerce|arts/i.test(line),
      ) ||
      block[0];
    if (qualification && /^\d{4}$/.test(qualification) && !institution) {
      block = [];
      return;
    }
    if (qualification || institution) {
      entries.push({
        qualification: /^\d{4}$/.test(qualification || '') ? String(institution || qualification) : qualification || String(institution || ''),
        institution:
          institution && institution !== qualification && !/^\d{4}$/.test(institution) ? institution : null,
        yearCompleted: yearMatch ? Number.parseInt(yearMatch[1], 10) : null,
      });
    }
    block = [];
  };

  for (const line of useful) {
    const isYearOnly = /^(19|20)\d{2}$/.test(line.trim());
    const startsNewDegree =
      block.length > 0 &&
      DEGREE_PATTERN.test(line) &&
      block.some((b) => DEGREE_PATTERN.test(b));

    if (startsNewDegree) {
      flush();
    }
    if (isYearOnly && block.length === 0) {
      continue;
    }
    block.push(line);
  }
  flush();

  return entries.length ? entries : [{ qualification: useful[0], institution: null, yearCompleted: null }];
}

function looksLikeProjectTitle(line: string) {
  if (!isShortLabel(line) || isBullet(line)) return false;
  if (/^(technologies|tech stack|tools|stack|environment|client|role)\b/i.test(line)) return false;
  if (PERSONAL_LEAK_LABELS.test(line)) return false;
  if (DEGREE_PATTERN.test(line)) return false;
  return true;
}

function parseProjects(lines: string[]): NonNullable<ResumeContent['projects']> {
  if (!lines.length) return [];
  const projects: NonNullable<ResumeContent['projects']> = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (PERSONAL_LEAK_LABELS.test(line)) {
      i += 1;
      continue;
    }
    if (!looksLikeProjectTitle(line)) {
      const orphan: string[] = [];
      while (i < lines.length && !looksLikeProjectTitle(lines[i]) && !PERSONAL_LEAK_LABELS.test(lines[i])) {
        orphan.push(stripBullet(lines[i]));
        i += 1;
      }
      if (orphan.length) {
        const { description, technologies } = extractProjectTechnologies(orphan);
        projects.push({
          name: 'Project',
          description,
          bullets: orphan,
          ...(technologies.length ? { technologies } : {}),
        });
      }
      continue;
    }

    const name = line;
    i += 1;
    const body: string[] = [];
    while (i < lines.length) {
      const next = lines[i];
      if (PERSONAL_LEAK_LABELS.test(next)) break;
      if (looksLikeProjectTitle(next) && body.length > 0) break;
      if (looksLikeProjectTitle(next) && body.length === 0) break;
      body.push(stripBullet(next));
      i += 1;
    }

    const unique: string[] = [];
    for (const row of body) {
      if (!row) continue;
      if (!unique.some((item) => item.startsWith(row.slice(0, 40)) || row.startsWith(item.slice(0, 40)))) {
        unique.push(row);
      }
    }
    const { description, technologies } = extractProjectTechnologies(unique);
    const bullets = unique.filter((row) => !/^(technologies?|tech\s*stack|tools?|stack)\s*[:|\-–—]/i.test(row));
    projects.push({
      name,
      description,
      ...(bullets.length ? { bullets } : {}),
      ...(technologies.length ? { technologies } : {}),
    });
  }

  return projects;
}

function tokenizeSkillish(lines: string[]) {
  return lines
      .join(',')
    .split(/[,;•|/·\t]+/)
    .map((item) => item.replace(/^[-•*]\s+/, '').trim())
    .map((item) => item.replace(/^(languages?|tools?|technologies?|frameworks?|databases?)\s*[:|\-–]?\s*/i, '').trim())
    .filter((item) => item.length > 1 && item.length < 40)
    .filter((item) => !PLACEHOLDER_LINES.has(item.toLowerCase()))
    .filter((item) => !PERSONAL_LEAK_LABELS.test(item))
    .filter((item) => !/^(19|20)\d{2}$/.test(item))
    .filter((item) => !/^(languages?|tools?|technologies?)$/i.test(item));
}

function canonicalizeSkill(raw: string): string {
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const aliases: Record<string, string> = {
    javascript: 'JavaScript',
    js: 'JavaScript',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    java: 'Java',
    python: 'Python',
    'c++': 'C++',
    'c#': 'C#',
    csharp: 'C#',
    'objective-c': 'Objective-C',
    objectivec: 'Objective-C',
    react: 'React',
    reactjs: 'React',
    'react.js': 'React',
    'react js': 'React',
    node: 'Node.js',
    nodejs: 'Node.js',
    'node.js': 'Node.js',
    'node js': 'Node.js',
    nextjs: 'Next.js',
    'next.js': 'Next.js',
    mongodb: 'MongoDB',
    postgres: 'PostgreSQL',
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    aws: 'AWS',
    sql: 'SQL',
    html: 'HTML',
    css: 'CSS',
    git: 'Git',
    github: 'GitHub',
    'power bi': 'Power BI',
    powerbi: 'Power BI',
    excel: 'Excel',
    kotlin: 'Kotlin',
    swift: 'Swift',
    swiftui: 'SwiftUI',
  };
  if (aliases[key]) return aliases[key];
  if (key.length <= 3) return raw.toUpperCase() === raw ? raw : raw;
  return raw.trim();
}

function dedupeSkills(items: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const canonical = canonicalizeSkill(item);
    const key = canonical.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out;
}

function parseSkills(lines: string[]) {
  return dedupeSkills(tokenizeSkillish(lines));
}

export function classifyLanguageTokens(tokens: string[]): { human: string[]; tech: string[] } {
  const human: string[] = [];
  const tech: string[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase().replace(/\s+/g, ' ').trim();
    const base = key.split(/[:(/-]/)[0]?.trim() || key;
    if (HUMAN_LANGUAGES.has(base) || HUMAN_LANGUAGES.has(key)) {
      human.push(token);
      continue;
    }
    if (TECH_SKILL_HINTS.has(base) || TECH_SKILL_HINTS.has(key) || /c\+\+|objective[\s-]?c|java|script|python|kotlin|swift/i.test(base)) {
      tech.push(token);
      continue;
    }
    // Ambiguous short tokens in a Languages section: prefer human only if known; else tech if looks technical
    if (/^[A-Za-z+#.+-]{1,20}$/.test(token) && !HUMAN_LANGUAGES.has(base)) {
      tech.push(token);
    } else {
      human.push(token);
    }
  }
  return { human: dedupeSkills(human), tech: dedupeSkills(tech) };
}

function extractSkillsFromExperienceText(experiences: ResumeContent['experiences'], existing: string[]) {
  const found: string[] = [];
  const blob = experiences.map((e) => `${e.jobTitle} ${e.company} ${e.description || ''}`).join(' ').toLowerCase();
  for (const skill of TECH_SKILL_HINTS) {
    if (skill.length < 2) continue;
    const re = new RegExp(`(?:^|[^a-z0-9+.#])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9+.#]|$)`, 'i');
    if (re.test(blob)) {
      // Prefer canonical casing from hints list
      const label = skill === 'nodejs' ? 'Node.js' : skill === 'nextjs' ? 'Next.js' : skill === 'powershell' ? 'PowerShell' : skill.replace(/\b\w/g, (c) => c.toUpperCase());
      found.push(label === 'Sql' ? 'SQL' : label === 'Aws' ? 'AWS' : label === 'Html' ? 'HTML' : label === 'Css' ? 'CSS' : label);
    }
  }
  return dedupeSkills([...existing, ...found]);
}

function parseCerts(lines: string[]) {
  return lines
    .map(stripBullet)
    .filter((item) => !PLACEHOLDER_LINES.has(item.toLowerCase()))
    .filter((item) => !PERSONAL_LEAK_LABELS.test(item))
    .map((line) => {
      const match = line.match(/^(.+?)\s*[—–-]\s*(.+?)(?:\s*\(([^)]+)\))?$/);
      if (match) {
        return {
          name: match[1].trim(),
          issuer: match[2].trim() || null,
          date: match[3]?.trim() || null,
        };
      }
      const withDate = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (withDate) {
        return { name: withDate[1].trim(), issuer: null, date: withDate[2].trim() };
      }
      return { name: line, issuer: null, date: null };
    });
}

function parseAchievements(lines: string[]) {
  return lines
    .map(stripBullet)
    .filter((item) => !PLACEHOLDER_LINES.has(item.toLowerCase()))
    .filter((item) => !looksLikePageMarker(item))
    .filter((item) => !PERSONAL_LEAK_LABELS.test(item))
    .map((line) => ({
      title: line,
      organization: null as string | null,
      description: null as string | null,
      date: null as string | null,
    }));
}

function extractPersonalFields(lines: string[]) {
  const joined = lines.join('\n');
  const email = extractEmail(joined);
  const phone = extractPhone(joined);
  const location = extractLocationFromText(lines);
  const nameLine = lines.find(
    (line) =>
      !line.includes('@') &&
      !PERSONAL_LEAK_LABELS.test(line) &&
      !looksLikeLocationFragment(line) &&
      !/^\+?\d/.test(line) &&
      isShortLabel(line) &&
      line.split(/\s+/).length <= 5,
  );
  return { email, phone, location, nameLine };
}

export function parseExtractedResumeText(rawText: string): ResumeContent {
  // Filename must never influence parsing — callers may pass only file bytes/text.
  let lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\u0000/g, ' ').trim())
    .filter((line) => line && !looksLikePageMarker(line) && !/^-- page \d+ --$/i.test(line));

  // Plan A: reflow mid-sentence wrap bullets before sectioning / entity parse
  lines = reflowBulletWraps(lines);

  // Plan B: document-wide PII sweep — capture personal fields, strip from body streams
  const swept = sweepPersonalFromLines(lines);
  lines = swept.strippedLines.length ? swept.strippedLines : lines;

  const sections = new Map<SectionKey, string[]>();
  let current: SectionKey | 'header' = 'header';
  const header: string[] = [];
  const detected: Array<{ section: string; preview: string }> = [];

  // Plan F: when headings appear late, rescue pre-heading body into real buckets
  const lateRescue = rescueLateHeadingBody(lines, (line) => headingKey(line));
  const rescuedIndexes = new Set<number>();
  for (const row of lateRescue.preHeading) {
    const idx = lines.indexOf(row.line);
    if (idx >= 0 && idx < lateRescue.firstHeadingIndex) rescuedIndexes.add(idx);
    if (row.bucket === 'header') {
      header.push(row.line);
      continue;
    }
    const key = row.bucket as SectionKey;
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(row.line);
    detected.push({ section: `rescue:${key}`, preview: row.line.slice(0, 60) });
  }

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const line = lines[lineIdx];
    if (rescuedIndexes.has(lineIdx)) continue;
    const key = headingKey(line);
    if (key) {
      current = key;
      if (key !== 'skip' && !sections.has(key)) sections.set(key, []);
      detected.push({ section: key, preview: line.slice(0, 80) });
      continue;
    }
    if (current === 'skip') continue;
    // Content-based soft section switch when no explicit heading yet / mid-header
    if (current === 'header' || current === 'summary') {
      const inferred = inferSectionFromContentLine(line);
      if (inferred && inferred !== 'summary') {
        current = inferred;
        if (!sections.has(inferred)) sections.set(inferred, []);
        detected.push({ section: inferred, preview: `inferred:${line.slice(0, 60)}` });
        sections.get(inferred)?.push(line);
        continue;
      }
    }
    if (current === 'header') header.push(line);
    else sections.get(current)?.push(line);
  }

  // If almost no sections found, classify remaining body lines by content.
  if (detected.filter((d) => !d.section.startsWith('inferred') && d.section !== 'header').length < 2) {
    inferMissingSectionsFromBody(lines, sections, header);
  }

  debugLog('detected-sections', detected);

  const personal = extractPersonalFields(sections.get('personal') || []);
  const headerText = header.join(' | ');
  const email = personal.email || extractEmail(headerText) || extractEmail(rawText);
  const phone = personal.phone || extractPhone(headerText) || extractPhone(rawText);
  const contactLine =
    header.find((line) => line.includes('|') || line.includes('@') || looksLikeLocationFragment(line)) ||
    lines.find((line) => line.includes('|') && (line.includes('@') || extractPhone(line))) ||
    lines.find((line) => /email\s*:/i.test(line) || /mobile\s*:/i.test(line)) ||
    '';
  // Prefer first clean "City, State" token from contact — never LinkedIn/GitHub tails.
  const contactLocationHint =
    contactLine
      .split(/[|•]/)
      .map((p) => p.trim())
      .find((p) => looksLikeLocationFragment(p) && !/linkedin|github|portfolio/i.test(p)) || null;
  const headerCity =
    (contactLocationHint && !isJunkCity(contactLocationHint) && contactLocationHint) ||
    (() => {
      const extracted = extractCity(contactLine, email, phone, [contactLine, ...header.slice(0, 5)]);
      return extracted && !isJunkCity(extracted) && !/linkedin|github/i.test(extracted) ? extracted : null;
    })();
  const personalCity = personal.location;
  const cityRaw = headerCity || (!isJunkCity(personalCity) && personalCity) || null;
  const locParts = splitLocationParts(cityRaw);
  const city = locParts.address ? locParts.city || null : isJunkCity(cityRaw) ? null : cityRaw;

  const nameCandidates = [
    personal.nameLine,
    ...header,
    ...lines.slice(0, 6),
  ].filter(Boolean) as string[];
  const fullName =
    nameCandidates
      .map((line) =>
        line
          .replace(/\s+Email\s*:.*$/i, '')
          .replace(/\s+Mobile\s*:.*$/i, '')
          .replace(/^([^|]+).*$/, '$1')
          .trim(),
      )
      .find(
        (line) =>
          Boolean(line) &&
          line !== contactLine &&
          !isJunkName(line) &&
          !line.includes('@') &&
          !looksLikeLocationFragment(line) &&
          !PERSONAL_LEAK_LABELS.test(line) &&
          !/^mobile\s*:/i.test(line) &&
          /^[A-Za-z][A-Za-z .']{1,50}$/.test(line),
      ) || 'Candidate';

  const links = extractProfileLinksFromText(rawText);
  const summaryLines = sections.get('summary') || [];
  // Objective bullets may sit in header when PDF order is wrong
  const headerObjective = header.filter((l) => /^[•\-\u2022]/.test(l) || /\b(maximize|seeking|objective)\b/i.test(l));
  const summary = (summaryLines.length ? summaryLines : headerObjective)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Global prose employment scan (survives bad PDF reading order / missing Experience heading).
  const proseJobs = extractProseExperiences(joinWrappedProseJobLines(lines));
  let experiences = mergeExperienceLists(
    proseJobs,
    parseExperience([
      ...(sections.get('experience') || []),
      // When PDF order dumps jobs into header before Work Experience heading
      ...header.filter((l) => /worked|working as/i.test(l)),
    ]),
  );
  // Plan E: collapse near-duplicate paragraphs for same employer; keep distinct employers
  experiences = collapseNearDuplicateExperiences(experiences);

  // Attach responsibility section lines to last matching job if still empty
  const responsibilityLines = (sections.get('responsibilities') || [])
    .map(stripBullet)
    .filter((l) => l && !PERSONAL_LEAK_LABELS.test(l) && !parseProseEmploymentLine(l));
  if (responsibilityLines.length && experiences.length) {
    const last = experiences[experiences.length - 1];
    if (!(last.responsibilities || []).length) {
      last.responsibilities = responsibilityLines;
      last.description = responsibilityLines.join('\n');
    }
  } else if (responsibilityLines.length && !experiences.length) {
    experiences = [
      {
        jobTitle: 'Professional Responsibilities',
        company: '',
        description: responsibilityLines.join('\n'),
        isInternship: false,
        responsibilities: responsibilityLines,
      },
    ];
  }

  const skillLines = [...(sections.get('skills') || [])];
  let skills = parseSkills(skillLines);

  // Pull "Languages known: Hindi, English..." from anywhere (often under Personal Profile).
  const languageSourceLines = [
    ...(sections.get('languages') || []),
    ...lines.filter((l) => /languages?\s*known|known\s+languages?/i.test(l)),
    ...(sections.get('personal') || []).filter((l) => /language/i.test(l)),
  ];
  const languageTokens = [
    ...tokenizeSkillish(sections.get('languages') || []),
    ...languageSourceLines.flatMap((l) => splitHumanLanguageList(l)),
  ];
  const { human: humanLanguages, tech: techFromLanguages } = classifyLanguageTokens(languageTokens);
  let languages = humanLanguages;
  if (swept.languagesLine) {
    languages = dedupeSkills([...languages, ...splitHumanLanguageList(swept.languagesLine)]);
  }
  // Drop address-like / PII language tokens
  languages = languages.filter((l) => !looksLikeAddressFragment(l) && !looksLikePersonalLeakToken(l));

  const programmingLanguages = dedupeSkills(
    techFromLanguages.filter((t) =>
      /^(c|c\+\+|c#|objective-?c|swift|swiftui|kotlin|java|javascript|typescript|python|go|golang|ruby|php|rust|scala|r)$/i.test(
        t.replace(/\s+/g, ''),
      ) || TECH_SKILL_HINTS.has(t.toLowerCase()),
    ),
  );
  skills = dedupeSkills([...skills, ...techFromLanguages].filter((s) => !looksLikePersonalLeakToken(s)));
  skills = extractSkillsFromExperienceText(experiences, skills);

  const education = parseEducation([
    ...(sections.get('education') || []),
    // Education bullets dumped into header by bad PDF order
    ...header.filter((l) => inferSectionFromContentLine(l) === 'education'),
  ]);
  const projects = parseProjects(sections.get('projects') || []);
  for (const project of projects) {
    if (project.technologies?.length) skills = dedupeSkills([...skills, ...project.technologies]);
  }

  let content: ResumeContent = {
    fullName: fullName.slice(0, 80),
    city,
    phone,
    email,
    summary,
    skills,
    programmingLanguages,
    education,
    experiences,
    languages,
    certifications: parseCerts(sections.get('certs') || []),
    achievements: parseAchievements(sections.get('achievements') || []),
    projects,
    includePhoto: false,
    fieldConfidence: [
      ...(email ? [{ field: 'email', value: email, confidence: 0.95, source: 'regex' }] : []),
      ...(phone ? [{ field: 'phone', value: phone, confidence: 0.9, source: 'regex' }] : []),
      ...(city
        ? [{ field: 'city', value: city, confidence: headerCity ? 0.92 : 0.65, source: headerCity ? 'contact_header' : 'personal' }]
        : []),
      ...(experiences.length
        ? [{ field: 'experiences', value: String(experiences.length), confidence: proseJobs.length >= 2 ? 0.9 : 0.7, source: 'section' }]
        : [{ field: 'experiences', value: '0', confidence: 0.4, source: 'missing' }]),
    ],
    ...(Object.keys(links).length ? { links } : {}),
  };

  content = ensureExperienceDateShape(content);
  content = crossValidateContent(content);
  content = attachPersonalBlock(content);

  // Merge swept PII into personal / city when contact header lacked them
  if (swept.address || swept.cityHint) {
    content = {
      ...content,
      city: content.city || swept.cityHint || content.city,
      personal: {
        ...content.personal,
        address: content.personal?.address || swept.address || undefined,
        city: content.personal?.city || swept.cityHint || content.city || undefined,
      },
    };
  }

  // Plan G: post-extract validators — flag/remove leaks; do not invent replacements
  const validated = validateAndSanitizeExtracted(content);
  content = validated.content;

  debugLog('normalized-content', {
    fullName: content.fullName,
    city: content.city,
    personal: content.personal,
    skills: content.skills.length,
    programmingLanguages: content.programmingLanguages,
    education: content.education.length,
    experiences: content.experiences.length,
    projects: content.projects?.length || 0,
    achievements: content.achievements?.length || 0,
    languages: content.languages,
    validationIssues: validated.issues.length,
  });

  return content;
}

function inferSectionFromContentLine(line: string): SectionKey | null {
  const cleaned = stripBullet(line);
  // Education only when the line itself is a degree/institution row — not summary prose mentioning BSc.
  if (
    /^(puc|b\.?\s*com|bcom|b\.?\s*sc|bsc|b\.?\s*tech|mca|mba|m\.?\s*tech|diploma|10th|12th|intermediate)\b/i.test(
      cleaned,
    ) ||
    (DEGREE_PATTERN.test(cleaned) &&
      cleaned.length < 90 &&
      /^(b\.?|m\.?|puc|diploma|bachelor|master|phd)/i.test(cleaned) &&
      !/\b(graduate with|knowledge in|skilled in|seeking)\b/i.test(cleaned))
  ) {
    return 'education';
  }
  if (parseProseEmploymentLine(cleaned) || (DATE_RANGE_PATTERN.test(cleaned) && (looksLikeJobTitle(cleaned) || looksLikeCompany(cleaned) || /\|/.test(cleaned)))) {
    return 'experience';
  }
  return null;
}

function inferMissingSectionsFromBody(
  lines: string[],
  sections: Map<SectionKey, string[]>,
  header: string[],
) {
  const bodyStart = Math.min(header.length + 1, lines.length);
  for (let i = bodyStart; i < lines.length; i += 1) {
    const line = lines[i];
    if (headingKey(line)) continue;
    if (PERSONAL_LEAK_LABELS.test(line)) {
      if (!sections.has('personal')) sections.set('personal', []);
      sections.get('personal')!.push(line);
      continue;
    }
    if (inferSectionFromContentLine(line) === 'experience' || (looksLikeJobTitle(line) && lines[i + 1])) {
      if (!sections.has('experience')) sections.set('experience', []);
      // gather until education/skills-like break
      while (i < lines.length) {
        const cur = lines[i];
        if (headingKey(cur) || (DEGREE_PATTERN.test(cur) && /university|college/i.test(cur))) break;
        sections.get('experience')!.push(cur);
        i += 1;
      }
      i -= 1;
      continue;
    }
    if (DEGREE_PATTERN.test(line)) {
      if (!sections.has('education')) sections.set('education', []);
      sections.get('education')!.push(line);
    }
  }
}

export function isThinResumeContent(content: ResumeContent) {
  return (
    !content.experiences?.length &&
    !content.education?.length &&
    !content.projects?.length &&
    (content.skills?.length || 0) <= 6
  );
}
