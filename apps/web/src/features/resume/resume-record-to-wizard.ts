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
  const links = content.links || content.resumeData?.links || {};

  return {
    fullName: content.fullName || '',
    location: content.city || '',
    email: content.email || '',
    phone: content.phone || '',
    summary: record.summary || content.summary || '',
    skills: content.skills || [],
    linkedin: links.linkedin || '',
    github: links.github || '',
    portfolio: links.portfolio || links.website || '',
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
    experienceList: (content.experiences || []).map((exp, index) => {
      const fromData = content.resumeData?.experience?.[index];
      return {
        id: `exp-${index}`,
        role: exp.jobTitle || '',
        company: exp.company || '',
        location: '',
        startDate: exp.startDate || fromData?.startDate || '',
        endDate: exp.endDate || fromData?.endDate || '',
        isCurrent: Boolean(
          exp.isCurrent ??
            fromData?.isCurrent ??
            (Boolean(exp.startDate || fromData?.startDate) &&
              !(exp.endDate || fromData?.endDate)),
        ),
        isInternship: Boolean(exp.isInternship) || /\bintern(?:ship|s)?\b/i.test(exp.jobTitle || ''),
        responsibilities: splitLines(exp.description),
      };
    }),
    projectList: (content.projects || []).map((project, index) => {
      const fromData = content.resumeData?.projects?.[index];
      const { description, bullets, technologies } = splitProjectFields({
        description: project.description,
        bullets: project.bullets ?? fromData?.bullets,
        technologies: [
          ...(project.technologies || []),
          ...((fromData?.technologies as string[] | undefined) || []),
        ],
      });
      return {
        id: `proj-${index}`,
        name: project.name || '',
        description,
        technologies,
        bullets: [...bullets],
      };
    }),
    certificationList: normalizeCertificationList(content.certifications).map((cert, index) => ({
      id: `cert-${index}`,
      name: cert.name,
      issuer: cert.issuer || '',
      date: cert.date || '',
    })),
    achievementList: (content.achievements || [])
      .filter((ach) => {
        const blob = [ach.title, ach.organization, ach.description].filter(Boolean).join(' ');
        return blob.trim() && !/^\d+\s*of\s*\d+$/i.test(blob.replace(/[-–—]/g, '').replace(/\s+/g, ''));
      })
      .map((ach, index) => ({
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
