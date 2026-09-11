import type { ResumeContent } from '@careerbridge/shared';
import type { MasterResumeDocument } from './master-resume.types';
import { dedupeBulletList, splitProjectFields } from './project-fields';

function parseYear(value: string) {
  const match = value.match(/(\d{4})/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

export function masterResumeToResumeContent(doc: MasterResumeDocument): ResumeContent {
  const skills = doc.technicalSkills.flatMap((group) => group.skills).filter(Boolean);
  return {
    fullName: doc.personalInfo.fullName,
    city: doc.personalInfo.location || null,
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
      isInternship: false,
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
      // Persist overview and bullets separately — never concatenate (was causing 2x/3x dupes).
      const { description, bullets } = splitProjectFields({
        description: item.description,
        bullets: item.bullets,
      });
      return {
        name: item.name,
        description: description || null,
        bullets: dedupeBulletList(bullets),
        url: item.url || null,
      };
    }),
    includePhoto: false,
  };
}
