import type { ResumeContent } from '@careerbridge/shared';

const SECTION_ALIASES: Record<string, SectionKey> = {
  SUMMARY: 'summary',
  'PROFESSIONAL SUMMARY': 'summary',
  'CAREER OBJECTIVE': 'summary',
  OBJECTIVE: 'summary',
  PROFILE: 'summary',
  'ABOUT ME': 'summary',
  ABOUT: 'summary',
  EXPERIENCE: 'experience',
  'WORK EXPERIENCE': 'experience',
  'PROFESSIONAL EXPERIENCE': 'experience',
  'EMPLOYMENT HISTORY': 'experience',
  EMPLOYMENT: 'experience',
  INTERNSHIP: 'experience',
  INTERNSHIPS: 'experience',
  'TECHNICAL SKILLS': 'skills',
  'TECHNICAL PROFICIENCIES': 'skills',
  SKILLS: 'skills',
  'CORE COMPETENCIES': 'skills',
  COMPETENCIES: 'skills',
  EDUCATION: 'education',
  'ACADEMIC QUALIFICATIONS': 'education',
  QUALIFICATIONS: 'education',
  ACADEMICS: 'education',
  PROJECTS: 'projects',
  'KEY PROJECTS': 'projects',
  'PERSONAL PROJECTS': 'projects',
  'ACADEMIC PROJECTS': 'projects',
  ACHIEVEMENTS: 'achievements',
  'KEY ACHIEVEMENTS': 'achievements',
  ACCOMPLISHMENTS: 'achievements',
  CERTIFICATIONS: 'certs',
  CERTIFICATE: 'certs',
  CERTIFICATES: 'certs',
  LICENSES: 'certs',
  'LICENSES & CERTIFICATIONS': 'certs',
  'CERTIFICATIONS AND LICENSES': 'certs',
  'ACHIEVEMENTS AND CERTIFICATIONS': 'achievements',
  'ACHIEVEMENTS & CERTIFICATIONS': 'achievements',
  'CERTIFICATIONS AND ACHIEVEMENTS': 'certs',
  'CERTIFICATIONS & ACHIEVEMENTS': 'certs',
  LANGUAGES: 'languages',
  'LANGUAGE PROFICIENCY': 'languages',
};

type SectionKey =
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'
  | 'certs'
  | 'achievements'
  | 'languages';

const PLACEHOLDER_LINES = new Set([
  'your college or university',
  'your name',
  'city, state',
]);

function headingKey(line: string): SectionKey | null {
  const key = line
    .replace(/[:\s]+$/g, '')
    .replace(/[•·|_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (SECTION_ALIASES[key]) return SECTION_ALIASES[key];
  // Soft match common variants like "TECHNICAL SKILL SET"
  if (/^TECHNICAL SKILL/.test(key)) return 'skills';
  if (/^WORK EXPER/.test(key) || /^PROFESSIONAL EXPER/.test(key)) return 'experience';
  if (/^CERTIFIC/.test(key)) return 'certs';
  if (/^ACHIEV/.test(key) || /^ACCOMPLISH/.test(key)) return 'achievements';
  if (/^PROJECT/.test(key)) return 'projects';
  if (/^EDUCAT|^ACADEMIC/.test(key)) return 'education';
  if (/^LANGUAGE/.test(key)) return 'languages';
  if (/^SUMMARY|^OBJECTIVE|^PROFILE|^ABOUT/.test(key)) return 'summary';
  return null;
}

function looksLikePageMarker(line: string) {
  return /^[-–—]?\s*\d+\s+of\s+\d+\s*[-–—]?$/i.test(line);
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
}

function extractPhone(text: string) {
  const match = text.match(/(\+?91[\s-]?)?[6-9]\d{9}/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 10) return digits;
  return match[0].trim();
}

function extractCity(contactLine: string, email: string | null, phone: string | null) {
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
  return cleaned || null;
}

function isShortLabel(line: string) {
  return line.length <= 60 && !/[.!?]$/.test(line) && line.split(' ').length <= 8;
}

function parseExperience(lines: string[]): ResumeContent['experiences'] {
  if (!lines.length) return [];
  const jobs: ResumeContent['experiences'] = [];
  let i = 0;
  while (i < lines.length) {
    const title = lines[i];
    const maybeCompany = lines[i + 1];
    if (maybeCompany && isShortLabel(title) && isShortLabel(maybeCompany) && !isBullet(maybeCompany)) {
      const bullets: string[] = [];
      i += 2;
      while (i < lines.length) {
        const next = lines[i];
        const following = lines[i + 1];
        if (
          following &&
          isShortLabel(next) &&
          isShortLabel(following) &&
          !isBullet(next) &&
          !isBullet(following)
        ) {
          break;
        }
        bullets.push(stripBullet(next));
        i += 1;
      }
      jobs.push({
        jobTitle: title,
        company: maybeCompany,
        description: bullets.join('\n') || null,
        isInternship: /intern/i.test(title),
      });
      continue;
    }
    jobs.push({
      jobTitle: title,
      company: '',
      description: lines.slice(i + 1).join('\n') || null,
      isInternship: /intern/i.test(title),
    });
    break;
  }
  return jobs;
}

function isBullet(line: string) {
  return /^[-•*]\s+/.test(line);
}

function stripBullet(line: string) {
  return line.replace(/^[-•*]\s+/, '').trim();
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
      [...block].reverse().find((line) => /university|college|institute|school|academy/i.test(line)) ||
      (block.length > 1 ? block[block.length - 1] : null);
    const qualification =
      block.find((line) =>
        /graduate|bachelor|master|b\.?tech|m\.?tech|b\.?e\.?\b|m\.?e\.?\b|diploma|phd|b\.?sc|m\.?sc|information|engineering|degree/i.test(
          line,
        ),
      ) || block[0];
    if (qualification || institution) {
      entries.push({
        qualification: qualification || String(institution || ''),
        institution:
          institution && institution !== qualification ? institution : null,
        yearCompleted: yearMatch ? Number.parseInt(yearMatch[1], 10) : null,
      });
    }
    block = [];
  };

  for (const line of useful) {
    const startsNew =
      block.length > 0 &&
      isShortLabel(line) &&
      (/university|college|institute|school|academy|bachelor|master|b\.?tech|m\.?tech|diploma|phd/i.test(line) ||
        /^\d{4}/.test(line));
    if (startsNew && block.length >= 2) flush();
    block.push(line);
  }
  flush();

  return entries.length ? entries : [{ qualification: useful[0], institution: null, yearCompleted: null }];
}

function looksLikeProjectTitle(line: string) {
  if (!isShortLabel(line) || isBullet(line)) return false;
  if (/^(technologies|tech stack|tools|stack)\b/i.test(line)) return false;
  return true;
}

function parseProjects(lines: string[]): NonNullable<ResumeContent['projects']> {
  if (!lines.length) return [];
  const projects: NonNullable<ResumeContent['projects']> = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!looksLikeProjectTitle(line)) {
      // Orphan bullets before a title — attach to a generic project once.
      const orphan: string[] = [];
      while (i < lines.length && !looksLikeProjectTitle(lines[i])) {
        orphan.push(stripBullet(lines[i]));
        i += 1;
      }
      if (orphan.length) {
        projects.push({ name: 'Project', description: orphan.join('\n') || null });
      }
      continue;
    }

    const name = line;
    i += 1;
    const body: string[] = [];
    while (i < lines.length) {
      const next = lines[i];
      if (looksLikeProjectTitle(next) && body.length > 0) break;
      // Title immediately followed by another title (rare) — treat as separate projects.
      if (looksLikeProjectTitle(next) && body.length === 0 && i + 1 < lines.length && isBullet(lines[i + 1])) {
        break;
      }
      if (looksLikeProjectTitle(next) && body.length === 0) {
        // Consecutive titles with no body yet — still start next project.
        break;
      }
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
    projects.push({ name, description: unique.join('\n') || null });
  }

  return projects;
}

function parseSkills(lines: string[]) {
  return [...new Set(
    lines
      .join(',')
      .split(/[,;•|/]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 1 && item.length < 40),
  )];
}

function parseCerts(lines: string[]) {
  return lines
    .map(stripBullet)
    .filter((item) => !PLACEHOLDER_LINES.has(item.toLowerCase()))
    .map((line) => {
      // "SQL — HackerRank (January 2026)" or "SQL - HackerRank"
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
    .map((line) => ({
      title: line,
      organization: null as string | null,
      description: null as string | null,
      date: null as string | null,
    }));
}

export function parseExtractedResumeText(rawText: string): ResumeContent {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !looksLikePageMarker(line));

  const sections = new Map<SectionKey, string[]>();
  let current: SectionKey | 'header' = 'header';
  const header: string[] = [];

  for (const line of lines) {
    const key = headingKey(line);
    if (key) {
      current = key;
      if (!sections.has(key)) sections.set(key, []);
      continue;
    }
    if (current === 'header') header.push(line);
    else sections.get(current)?.push(line);
  }

  const headerText = header.join(' | ');
  const email = extractEmail(headerText) || extractEmail(rawText);
  const phone = extractPhone(headerText) || extractPhone(rawText);
  const contactLine = header.find((line) => line.includes('|') || line.includes('@')) || '';
  const city = extractCity(contactLine, email, phone);
  const fullName = header.find((line) => line !== contactLine && !line.includes('@')) || header[0] || 'Candidate';

  const summaryLines = sections.get('summary') || [];
  const summary = summaryLines.join(' ').replace(/\s+/g, ' ').trim();

  return {
    fullName: fullName.slice(0, 80),
    city,
    phone,
    email,
    summary,
    skills: parseSkills(sections.get('skills') || []),
    education: parseEducation(sections.get('education') || []),
    experiences: parseExperience(sections.get('experience') || []),
    languages: parseSkills(sections.get('languages') || []),
    certifications: parseCerts(sections.get('certs') || []),
    achievements: parseAchievements(sections.get('achievements') || []),
    projects: parseProjects(sections.get('projects') || []),
    includePhoto: false,
  };
}

export function isThinResumeContent(content: ResumeContent) {
  return (
    !content.experiences?.length &&
    !content.education?.length &&
    !content.projects?.length &&
    (content.skills?.length || 0) <= 6
  );
}
