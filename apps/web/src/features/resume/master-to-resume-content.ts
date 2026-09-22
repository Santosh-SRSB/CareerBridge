import type { ResumeContent } from '@careerbridge/shared';
import { withNormalizedResumeData } from '@careerbridge/shared';
import { parseCityState } from '@/data/india-locations';
import type { MasterResumeDocument } from './master-resume.types';
import { dedupeBulletList, splitProjectFields } from './project-fields';

function parseYear(value: string) {
  const match = value.match(/(\d{4})/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

/** Persist full master doc so ATS recheck reflects links, dates, and tech after edits. */
export function masterResumeToResumeContent(doc: MasterResumeDocument): ResumeContent {
  const skills = doc.technicalSkills.flatMap((group) => group.skills).filter(Boolean);
  const links = {
    linkedin: (doc.personalInfo.linkedin || '').trim() || undefined,
    github: (doc.personalInfo.github || '').trim() || undefined,
    portfolio: (doc.personalInfo.portfolio || '').trim() || undefined,
  };
  const hasLinks = Boolean(links.linkedin || links.github || links.portfolio);
  const { city, state } = parseCityState(doc.personalInfo.location || '');

  const content: ResumeContent = {
    fullName: doc.personalInfo.fullName,
    city: city || doc.personalInfo.location || null,
    state: state || null,
    phone: doc.personalInfo.phone || null,
    email: doc.personalInfo.email || null,
    summary: doc.summary,
    skills: [...new Set(skills)],
    education: doc.education.map((item) => ({
      qualification: [item.degree, item.field].filter(Boolean).join(' in ') || item.degree,
      institution: item.institution || null,
      yearCompleted: parseYear(item.endYear),
    })),
    experiences: doc.experience.map((item) => ({
      company: item.company,
      jobTitle: item.jobTitle,
      description: item.responsibilities.length ? item.responsibilities.join('\n') : null,
      isInternship: Boolean(item.isInternship) || /\bintern(?:ship|s)?\b/i.test(item.jobTitle),
      startDate: item.startDate?.trim() || null,
      endDate: item.isCurrent ? null : item.endDate?.trim() || null,
      isCurrent: Boolean(item.isCurrent),
    })),
    languages: (doc.languages || [])
      .map((item) => {
        const name = item.name.trim();
        if (!name) return '';
        return item.level?.trim() ? `${name} (${item.level.trim()})` : name;
      })
      .filter(Boolean),
    certifications: doc.certifications
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        issuer: item.issuer?.trim() || null,
        date: item.date?.trim() || null,
        url: item.credentialUrl?.trim() || null,
      })),
    achievements: doc.achievements
      .filter((item) => item.title.trim() || item.description.trim())
      .map((item) => ({
        title: item.title,
        organization: item.organization || null,
        description: item.description || null,
        date: item.date || null,
      })),
    projects: doc.projects.map((item) => {
      const { description, bullets, technologies } = splitProjectFields({
        description: item.description,
        bullets: item.bullets,
        technologies: item.technologies,
      });
      return {
        name: item.name,
        description: description || null,
        bullets: dedupeBulletList(bullets),
        url: item.url || null,
        technologies,
      };
    }),
    includePhoto: false,
    ...(hasLinks ? { links } : {}),
  };

  return withNormalizedResumeData(content, hasLinks ? { links } : undefined);
}
