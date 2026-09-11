import type { ResumeContent } from '@careerbridge/shared';
import { parseLanguageSkills } from '@careerbridge/shared';
import { buildMasterResume } from './build-master-resume';
import type { MasterResumeDocument } from './master-resume.types';
import { splitProjectFields } from './project-fields';
import { normalizeCertificationList } from './certification-fields';

export function buildResumeFromResumeContent(
  content: ResumeContent,
  summary?: string | null,
): MasterResumeDocument {
  return buildMasterResume({
    fullName: content.fullName || '',
    location: content.city || '',
    email: content.email || '',
    phone: content.phone || '',
    summary: summary?.trim() || content.summary || '',
    skills: content.skills || [],
    experienceList: (content.experiences || []).map((item) => ({
      role: item.jobTitle || '',
      company: item.company || '',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      responsibilities: item.description
        ? item.description
            .split(/\n+/)
            .map((line) => line.replace(/^[-•*]\s*/, '').trim())
            .filter(Boolean)
        : [],
    })),
    educationList: (content.education || []).map((item) => ({
      degree: item.qualification || '',
      field: '',
      institution: item.institution || '',
      location: '',
      startDate: '',
      endDate: item.yearCompleted ? `${item.yearCompleted}-06` : '',
      isCurrent: false,
    })),
    projectList: (content.projects || []).map((item) => {
      const { description, bullets } = splitProjectFields({
        description: item.description,
        bullets: item.bullets,
      });
      return {
        name: item.name || '',
        description,
        technologies: [],
        bullets: [...bullets],
      };
    }),
    certificationList: normalizeCertificationList(content.certifications).map((cert) => ({
      name: cert.name,
      issuer: cert.issuer || '',
      date: cert.date || '',
    })),
    achievementList: (content.achievements || []).map((ach) => ({
      title: ach.title || '',
      organization: ach.organization || '',
      description: ach.description || '',
      date: ach.date || '',
    })),
    languages: parseLanguageSkills((content.languages || []).join(', ')),
  });
}
