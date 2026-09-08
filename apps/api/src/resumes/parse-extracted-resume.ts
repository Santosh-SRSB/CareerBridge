import type { ResumeContent } from '@careerbridge/shared';

const SECTION_ALIASES: Record<string, SectionKey> = {
  SUMMARY: 'summary',
  'PROFESSIONAL SUMMARY': 'summary',
  'CAREER OBJECTIVE': 'summary',
  OBJECTIVE: 'summary',
  EXPERIENCE: 'experience',
  'WORK EXPERIENCE': 'experience',
  'PROFESSIONAL EXPERIENCE': 'experience',
  'TECHNICAL SKILLS': 'skills',
  SKILLS: 'skills',
  EDUCATION: 'education',
  PROJECTS: 'projects',
  'ACHIEVEMENTS AND CERTIFICATIONS': 'certs',
  ACHIEVEMENTS: 'certs',
  CERTIFICATIONS: 'certs',
  LANGUAGES: 'languages',
};

type SectionKey = 'summary' | 'experience' | 'skills' | 'education' | 'projects' | 'certs' | 'languages';

const PLACEHOLDER_LINES = new Set([
  'your college or university',
  'your name',
  'city, state',
]);

function headingKey(line: string): SectionKey | null {
  const key = line.replace(/[:\s]+$/g, '').trim().toUpperCase();
  return SECTION_ALIASES[key] || null;
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
  const institution =
    [...useful].reverse().find((line) => /university|college|institute|school/i.test(line)) ||
    useful[useful.length - 1] ||
    null;
  const qualification =
    useful.find((line) => /graduate|bachelor|master|b\.?tech|m\.?tech|diploma|phd|information/i.test(line)) ||
    useful[0];
  return [
    {
      qualification,
      institution: institution === qualification ? null : institution,
      yearCompleted: null,
    },
  ];
}

function parseProjects(lines: string[]): NonNullable<ResumeContent['projects']> {
  if (!lines.length) return [];
  const name = isShortLabel(lines[0]) ? lines[0] : 'Project';
  const rest = (isShortLabel(lines[0]) ? lines.slice(1) : lines).map(stripBullet);
  const unique: string[] = [];
  for (const line of rest) {
    if (!unique.some((item) => item.startsWith(line.slice(0, 40)) || line.startsWith(item.slice(0, 40)))) {
      unique.push(line);
    }
  }
  return [{ name, description: unique.join('\n') || null }];
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
  return lines.map(stripBullet).filter((item) => !PLACEHOLDER_LINES.has(item.toLowerCase()));
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
