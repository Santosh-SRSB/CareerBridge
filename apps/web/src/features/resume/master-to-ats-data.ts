import type { MasterResumeDocument } from './master-resume.types';

/** Maps Master Resume schema → ATS template component data shape */
export function masterResumeToAtsData(doc: MasterResumeDocument) {
  const { personalInfo } = doc;

  return {
    fullName: personalInfo.fullName || 'Your Name',
    title: '',
    email: personalInfo.email,
    phone: personalInfo.phone,
    location: personalInfo.location,
    linkedin: personalInfo.linkedin,
    website: personalInfo.portfolio || personalInfo.github,
    photo: '',
    summary: doc.summary,
    skills: doc.technicalSkills.flatMap((g) => g.skills),
    technicalSkills: doc.technicalSkills,
    experience: doc.experience.map((item, index) => ({
      company: item.company,
      role: item.jobTitle,
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      current: item.isCurrent,
      bullets: item.responsibilities,
    })),
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
    achievements: doc.achievements.map((item, index) => ({
      id: `ach-${index}`,
      title: item.title,
      organization: item.organization,
      date: item.date,
      description: item.description,
    })),
  };
}
