import type { ResumeContent } from '@careerbridge/shared';
import { formatResumeDate } from '@/lib/resume-dates';

/** Maps CareerBridge resume content into the friend's ATS template data shape. */
export function toAtsTemplateData(
  content: ResumeContent,
  options?: { title?: string | null; photoUrl?: string | null },
) {
  return {
    fullName: content.fullName || 'Your Name',
    title: options?.title || '',
    email: content.email || '',
    phone: content.phone || '',
    location: content.city || '',
    linkedin: '',
    website: '',
    photo: options?.photoUrl || '',
    summary: content.summary || '',
    skills: content.skills || [],
    experience: (content.experiences || []).map((item) => ({
      company: item.company,
      role: item.jobTitle,
      location: item.location || '',
      startDate: formatResumeDate(item.startDate || '') || '',
      endDate: item.isCurrent ? '' : formatResumeDate(item.endDate || '') || '',
      current: Boolean(item.isCurrent),
      bullets: item.description
        ? item.description
            .split(/\n|•/)
            .map((line) => line.trim())
            .filter(Boolean)
        : item.responsibilities?.length
          ? [...item.responsibilities]
          : [],
    })),
    education: (content.education || []).map((item, index) => ({
      id: `education-${index}`,
      level: '',
      institution: item.institution || '',
      school: item.institution || '',
      degree: item.qualification || '',
      fieldOfStudy: item.fieldOfStudy || '',
      field: item.fieldOfStudy || '',
      location: item.location || '',
      startDate: formatResumeDate(item.startDate || '') || '',
      endDate: item.isCurrent
        ? ''
        : formatResumeDate(item.endDate || '') ||
          (item.yearCompleted ? String(item.yearCompleted) : ''),
      grade: '',
      gpa: '',
    })),
    projects: (content.projects || []).map((item, index) => ({
      id: `project-${index}`,
      name: item.name,
      title: item.name,
      description: item.description || '',
      link: '',
      url: '',
      technologies: [],
      bullets: [],
      bulletPoints: [],
      startDate: '',
      endDate: '',
    })),
    certifications: (content.certifications || []).map((name, index) => ({
      id: `cert-${index}`,
      name,
      issuer: '',
      date: '',
      url: '',
    })),
  };
}
