import type { ResumeRecord } from '@careerbridge/shared';
import { parseLanguageSkills } from '@careerbridge/shared';
import { splitProjectFields } from './project-fields';
import { normalizeCertificationList } from './certification-fields';

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
  const languageNames = new Set(
    languages.map((entry) => parseLanguageSkills(entry)[0]?.name || entry),
  );

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
    projectList: (content.projects || []).map((project, index) => {
      const { description, bullets } = splitProjectFields({
        description: project.description,
        bullets: project.bullets,
      });
      return {
        id: `proj-${index}`,
        name: project.name || '',
        description,
        technologies: [],
        bullets: [...bullets],
      };
    }),
    certificationList: normalizeCertificationList(content.certifications).map((cert, index) => ({
      id: `cert-${index}`,
      name: cert.name,
      issuer: cert.issuer || '',
      date: cert.date || '',
    })),
    achievementList: (content.achievements || []).map((ach, index) => ({
      id: `ach-${index}`,
      title: ach.title || '',
      organization: ach.organization || '',
      description: ach.description || '',
      date: ach.date || '',
    })),
    languages,
    availableLanguages: LANGUAGE_POOL.filter((name) => !languageNames.has(name)),
    preferredRole: record.targetJobTitle || '',
    preferredLocation: content.city || '',
    expectedSalary: '',
  };
}
