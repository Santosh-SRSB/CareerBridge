export interface MasterPersonalInfo {
  fullName: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface MasterExperience {
  jobTitle: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string[];
}

export interface MasterTechnicalSkillGroup {
  category: string;
  skills: string[];
}

export interface MasterEducation {
  degree: string;
  field: string;
  institution: string;
  location: string;
  startYear: string;
  endYear: string;
  grade: string;
  gradeType: string;
}

export interface MasterProject {
  name: string;
  technologies: string[];
  description: string;
  url: string;
  bullets: string[];
}

export interface MasterAchievement {
  title: string;
  organization: string;
  date: string;
  description: string;
}

export interface MasterCertification {
  name: string;
  issuer: string;
  date: string;
  credentialUrl: string;
}

export interface MasterLanguage {
  name: string;
  level: string;
}

export interface MasterResumeDocument {
  personalInfo: MasterPersonalInfo;
  summary: string;
  experience: MasterExperience[];
  technicalSkills: MasterTechnicalSkillGroup[];
  education: MasterEducation[];
  projects: MasterProject[];
  achievements: MasterAchievement[];
  certifications: MasterCertification[];
  languages: MasterLanguage[];
}
