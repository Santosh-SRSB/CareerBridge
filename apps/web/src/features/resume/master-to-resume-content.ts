import type { ResumeContent } from '@careerbridge/shared';
import type { MasterResumeDocument } from './master-resume.types';

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
    languages: [],
    certifications: doc.certifications.map((item) => item.name).filter(Boolean),
    projects: doc.projects.map((item) => ({
      name: item.name,
      description: [item.description, ...(item.bullets || [])].filter(Boolean).join('\n') || null,
    })),
    includePhoto: false,
  };
}
