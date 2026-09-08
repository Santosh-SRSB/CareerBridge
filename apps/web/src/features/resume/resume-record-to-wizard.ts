import type { ResumeRecord } from '@careerbridge/shared';

const LANGUAGE_POOL = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
];

function splitLines(text: string | null | undefined) {
  if (!text?.trim()) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

function splitDegreeAndField(qualification: string) {
  const match = qualification.match(/^(.+?)\s+in\s+(.+)$/i);
  if (!match) return { degree: qualification, field: '' };
  return { degree: match[1].trim(), field: match[2].trim() };
}

export function mapResumeRecordToWizardSeed(record: ResumeRecord) {
  const content = record.content;
  const languages = content.languages || [];

  return {
    fullName: content.fullName || '',
    location: content.city || '',
    email: content.email || '',
    phone: content.phone || '',
    summary: record.summary || content.summary || '',
    skills: content.skills || [],
    educationList: (content.education || []).map((edu, index) => {
      const parsed = splitDegreeAndField(edu.qualification || '');
      return {
        id: `edu-${index}`,
        degree: parsed.degree,
        field: parsed.field,
        institution: edu.institution || '',
        location: '',
        startDate: '',
        endDate: edu.yearCompleted ? `${edu.yearCompleted}-06` : '',
        isCurrent: false,
        grade: '',
        gradeType: '',
      };
    }),
    experienceList: (content.experiences || []).map((exp, index) => ({
      id: `exp-${index}`,
      role: exp.jobTitle || '',
      company: exp.company || '',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      responsibilities: splitLines(exp.description),
    })),
    projectList: (content.projects || []).map((project, index) => ({
      id: `proj-${index}`,
      name: project.name || '',
      description: project.description || '',
      technologies: [],
      bullets: splitLines(project.description),
    })),
    certificationList: (content.certifications || []).map((name, index) => ({
      id: `cert-${index}`,
      name,
      issuer: '',
      date: '',
    })),
    achievementList: [],
    languages,
    availableLanguages: LANGUAGE_POOL.filter((name) => !languages.includes(name)),
    preferredRole: record.targetJobTitle || '',
    preferredLocation: content.city || '',
    expectedSalary: '',
  };
}
