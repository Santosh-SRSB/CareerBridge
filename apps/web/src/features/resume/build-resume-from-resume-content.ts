import type { ResumeContent } from '@careerbridge/shared';
import { buildMasterResume } from './build-master-resume';
import type { MasterResumeDocument } from './master-resume.types';

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
    projectList: (content.projects || []).map((item) => ({
      name: item.name || '',
      description: item.description || '',
      technologies: [],
      bullets: item.description
        ? item.description
            .split(/\n+/)
            .map((line) => line.replace(/^[-•*]\s*/, '').trim())
            .filter(Boolean)
        : [],
    })),
    certificationList: (content.certifications || []).map((name) => ({
      name,
      issuer: '',
      date: '',
    })),
    achievementList: [],
  });
}
