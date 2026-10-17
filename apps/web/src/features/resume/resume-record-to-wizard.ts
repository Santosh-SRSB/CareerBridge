import type { ResumeRecord } from '@careerbridge/shared';
import { parseLanguageSkills, toMonthInputValue } from '@careerbridge/shared';
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
  const personal = content.personal;

  const skills = [
    ...(content.skills || []),
    ...(content.programmingLanguages || []).filter(
      (p) => !(content.skills || []).some((s) => s.toLowerCase() === p.toLowerCase()),
    ),
  ];

  return {
    fullName: personal?.fullName || content.fullName || '',
    location:
      [personal?.city || content.city, personal?.state, personal?.country].filter(Boolean).join(', ') ||
      content.city ||
      '',
    email: personal?.email || content.email || '',
    phone: personal?.phone || content.phone || '',
    summary: record.summary || content.summary || '',
    skills,
    linkedin: personal?.linkedin || links.linkedin || '',
    github: personal?.github || links.github || '',
    portfolio: personal?.portfolio || links.portfolio || links.website || '',
    educationList: (content.education || []).map((edu, index) => {
      const parsed = splitDegreeAndField(edu.qualification || '');
      return {
        id: `edu-${index}`,
        degree: parsed.degree,
        field: edu.fieldOfStudy || parsed.field,
        institution: edu.institution || '',
        location: edu.location || '',
        startDate: toMonthInputValue(edu.startDate) || '',
        endDate:
          toMonthInputValue(edu.endDate) ||
          (edu.yearCompleted ? `${edu.yearCompleted}-06` : ''),
        isCurrent: Boolean(edu.isCurrent),
        grade: '',
        gradeType: '',
      };
    }),
    experienceList: (content.experiences || []).map((exp, index) => {
      const fromData = content.resumeData?.experience?.[index];
      const isCurrent = Boolean(exp.isCurrent ?? fromData?.isCurrent);
      const responsibilities =
        Array.isArray(exp.responsibilities) && exp.responsibilities.length
          ? exp.responsibilities
          : splitLines(exp.description);
      return {
        id: `exp-${index}`,
        role: exp.jobTitle || '',
        company: exp.company || '',
        location: exp.location || '',
        startDate:
          toMonthInputValue(exp.startDate || fromData?.startDate) ||
          exp.startDate ||
          fromData?.startDate ||
          '',
        endDate: isCurrent
          ? ''
          : toMonthInputValue(exp.endDate || fromData?.endDate) ||
            exp.endDate ||
            fromData?.endDate ||
            '',
        isCurrent,
        isInternship: Boolean(exp.isInternship) || /\bintern(?:ship|s)?\b/i.test(exp.jobTitle || ''),
        responsibilities,
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
    preferredLocation: personal?.city || content.city || '',
    expectedSalary: '',
  };
}
