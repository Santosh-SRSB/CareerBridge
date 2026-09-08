import type { MasterResumeDocument } from './master-resume.types';
import { formatDateForResume, formatEducationYearRange } from '@/lib/resume-dates';
import { isValidEmail, isValidPhone } from './resume-wizard-validation';

interface EducationItem {
  degree: string;
  field?: string;
  institution: string;
  location?: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  grade?: string;
  gradeType?: string;
}

interface ExperienceItem {
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities?: string[];
}

interface ProjectItem {
  name: string;
  description: string;
  technologies?: string[];
  bullets?: string[];
}

interface CertificationItem {
  name: string;
  issuer: string;
  date: string;
}

interface AchievementItem {
  title: string;
  organization?: string;
  description: string;
  date?: string;
}

export interface BuildMasterResumeInput {
  fullName: string;
  location: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary: string;
  skills: string[];
  experienceList: ExperienceItem[];
  educationList: EducationItem[];
  projectList: ProjectItem[];
  certificationList: CertificationItem[];
  achievementList: AchievementItem[];
}

export function buildMasterResume(input: BuildMasterResumeInput): MasterResumeDocument {
  const technicalSkills =
    input.skills.length > 0 ? [{ category: '', skills: input.skills }] : [];

  return {
    personalInfo: {
      fullName: input.fullName.trim(),
      location: input.location.trim(),
      email: (input.email || '').trim(),
      phone: (input.phone || '').trim(),
      linkedin: (input.linkedin || '').trim(),
      github: (input.github || '').trim(),
      portfolio: (input.portfolio || '').trim(),
    },
    summary: input.summary.trim(),
    experience: input.experienceList.map((exp) => ({
      jobTitle: exp.role.trim(),
      company: exp.company.trim(),
      location: exp.location.trim(),
      startDate: formatDateForResume(exp.startDate),
      endDate: exp.isCurrent ? '' : formatDateForResume(exp.endDate),
      isCurrent: exp.isCurrent,
      responsibilities: (exp.responsibilities || []).map((r) => r.trim()).filter(Boolean),
    })),
    technicalSkills,
    education: input.educationList.map((edu) => {
      const yearRange = formatEducationYearRange(edu.startDate, edu.isCurrent ? '' : edu.endDate);
      const parts = yearRange.split(' – ');
      return {
        degree: edu.degree.trim(),
        field: (edu.field || '').trim(),
        institution: edu.institution.trim(),
        location: (edu.location || '').trim(),
        startYear: parts[0] || '',
        endYear: parts[1] || '',
        grade: (edu.grade || '').trim(),
        gradeType: (edu.gradeType || '').trim(),
      };
    }),
    projects: input.projectList.map((proj) => ({
      name: proj.name.trim(),
      technologies: (proj.technologies || []).map((t) => t.trim()).filter(Boolean),
      description: proj.description.trim(),
      url: '',
      bullets: (proj.bullets || []).map((b) => b.trim()).filter(Boolean),
    })),
    achievements: input.achievementList.map((ach) => ({
      title: ach.title.trim(),
      organization: (ach.organization || '').trim(),
      date: formatDateForResume(ach.date || ''),
      description: ach.description.trim(),
    })),
    certifications: input.certificationList.map((cert) => ({
      name: cert.name.trim(),
      issuer: cert.issuer.trim(),
      date: formatDateForResume(cert.date),
      credentialUrl: '',
    })),
  };
}

export function validateMasterResume(doc: MasterResumeDocument): string[] {
  const errors: string[] = [];
  if (!doc.personalInfo.fullName) {
    errors.push('Name is required.');
  }
  if (!doc.personalInfo.email) {
    errors.push('Email is required.');
  } else if (!isValidEmail(doc.personalInfo.email)) {
    errors.push('Enter a valid email address.');
  }
  if (!doc.personalInfo.phone) {
    errors.push('Phone number is required.');
  } else if (!isValidPhone(doc.personalInfo.phone)) {
    errors.push('Enter a valid 10-digit Indian mobile number.');
  }
  if (!doc.personalInfo.location.trim()) {
    errors.push('Location is required.');
  }
  if (doc.education.length === 0) {
    errors.push('Add at least one education entry.');
  }
  const hasSkills = doc.technicalSkills.some((group) => group.skills.length > 0);
  if (!hasSkills) {
    errors.push('Add at least one skill.');
  }
  return errors;
}
