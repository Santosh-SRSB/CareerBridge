import type { MasterResumeDocument } from './master-resume.types';

function normalizeCompanyKey(company: string) {
  return company.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isInternshipRole(role: string, isInternship?: boolean) {
  if (isInternship) return true;
  return /\bintern(?:ship|s)?\b/i.test(role);
}

/** Prefer full-time before internship at the same company; otherwise newest first. */
export function sortExperienceForResume<
  T extends {
    company?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    isInternship?: boolean;
  },
>(jobs: T[]): T[] {
  const monthScore = (value?: string) => {
    if (!value?.trim()) return 0;
    const raw = value.trim();
    const iso = raw.match(/^(\d{4})-(\d{2})/);
    if (iso) return Number(iso[1]) * 12 + Number(iso[2]);
    const named = raw.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/i);
    if (named) {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const m = months.indexOf(named[1].slice(0, 3).toLowerCase());
      return Number(named[2]) * 12 + (m >= 0 ? m + 1 : 1);
    }
    const year = raw.match(/(20\d{2}|19\d{2})/);
    return year ? Number(year[1]) * 12 : 0;
  };

  const recency = (job: T) => {
    if (job.current) return 999999;
    return Math.max(monthScore(job.endDate), monthScore(job.startDate));
  };

  return [...jobs].sort((a, b) => {
    const ca = normalizeCompanyKey(a.company || '');
    const cb = normalizeCompanyKey(b.company || '');
    if (ca && ca === cb) {
      const ai = isInternshipRole(a.role || '', a.isInternship) ? 1 : 0;
      const bi = isInternshipRole(b.role || '', b.isInternship) ? 1 : 0;
      if (ai !== bi) return ai - bi; // full-time first, then intern
    }
    return recency(b) - recency(a);
  });
}

function isPageMarkerAchievement(text: string) {
  const cleaned = text
    .trim()
    .replace(/[-–—•|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return true;
  if (/^(page\s+)?\d+\s*of\s*\d+$/i.test(cleaned.replace(/\s+/g, ''))) return true;
  if (/^(page\s+)?\d+\s+of\s+\d+$/i.test(cleaned)) return true;
  if (/^page\s+\d+$/i.test(cleaned)) return true;
  return false;
}

/** Maps Master Resume schema → ATS template component data shape */
export function masterResumeToAtsData(doc: MasterResumeDocument) {
  const { personalInfo } = doc;

  const experience = sortExperienceForResume(
    doc.experience.map((item) => ({
      company: item.company,
      role: item.jobTitle,
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      current: item.isCurrent,
      bullets: item.responsibilities,
      isInternship: item.isInternship || /\bintern(?:ship|s)?\b/i.test(item.jobTitle),
    })),
  );

  return {
    fullName: personalInfo.fullName || 'Your Name',
    title: '',
    email: personalInfo.email,
    phone: personalInfo.phone,
    location: personalInfo.location,
    linkedin: personalInfo.linkedin,
    github: personalInfo.github,
    website: personalInfo.portfolio || personalInfo.website,
    portfolio: personalInfo.portfolio,
    photo: '',
    summary: doc.summary,
    skills: doc.technicalSkills.flatMap((g) => g.skills),
    technicalSkills: doc.technicalSkills,
    experience,
    education: doc.education.map((item, index) => ({
      id: `education-${index}`,
      level: '',
      institution: item.institution,
      school: item.institution,
      degree: item.degree,
      fieldOfStudy: item.field,
      field: item.field,
      location: item.location,
      startDate: item.startYear,
      endDate: item.endYear,
      grade: item.gradeType && item.grade ? `${item.gradeType}: ${item.grade}` : item.grade,
      gpa: item.gradeType && item.grade ? `${item.gradeType}: ${item.grade}` : item.grade,
    })),
    projects: doc.projects.map((item, index) => ({
      id: `project-${index}`,
      name: item.name,
      title: item.name,
      description: item.description,
      link: item.url,
      url: item.url,
      technologies: item.technologies,
      bullets: item.bullets,
      bulletPoints: item.bullets,
      startDate: '',
      endDate: '',
    })),
    certifications: doc.certifications.map((item, index) => ({
      id: `cert-${index}`,
      name: item.name,
      issuer: item.issuer,
      date: item.date,
      url: item.credentialUrl,
    })),
    achievements: doc.achievements
      .map((item, index) => ({
        id: `ach-${index}`,
        title: item.title,
        organization: item.organization,
        date: item.date,
        description: item.description,
      }))
      .filter((item) => {
        const blob = [item.title, item.organization, item.description].filter(Boolean).join(' ');
        return blob.trim() && !isPageMarkerAchievement(blob);
      }),
    languages: (doc.languages || []).map((item, index) => ({
      id: `lang-${index}`,
      name: item.name,
      level: item.level,
      proficiency: item.level,
      description: item.level,
    })),
  };
}
