import type { ResumeContent } from '@careerbridge/shared';
import { parseLanguageSkills } from '@careerbridge/shared';
import { formatCityState, parseCityState } from '@/data/india-locations';
import { buildMasterResume } from './build-master-resume';
import type { MasterResumeDocument } from './master-resume.types';
import { splitProjectFields } from './project-fields';
import { normalizeCertificationList } from './certification-fields';

function locationFromContent(content: Pick<ResumeContent, 'city' | 'state'>) {
  const raw = [content.city, content.state].filter(Boolean).join(', ').trim() || content.city || '';
  const parsed = parseCityState(raw);
  return formatCityState(parsed.city, parsed.state) || raw;
}

function splitDegreeAndField(qualification: string) {
  const match = qualification.match(/^(.+?)\s+in\s+(.+)$/i);
  if (!match) return { degree: qualification, field: '' };
  return { degree: match[1].trim(), field: match[2].trim() };
}

/** Rebuild master resume including links / dates / technologies for ATS recheck. */
export function buildResumeFromResumeContent(
  content: ResumeContent,
  summary?: string | null,
  extras?: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
  },
): MasterResumeDocument {
  const links = content.links || content.resumeData?.links || {};
  const linkedin = extras?.linkedin || links.linkedin || '';
  const github = extras?.github || links.github || '';
  const portfolio = extras?.portfolio || links.portfolio || links.website || '';

  return buildMasterResume({
    fullName: content.fullName || '',
    location: locationFromContent(content),
    email: content.email || '',
    phone: content.phone || '',
    linkedin,
    github,
    portfolio,
    summary: summary?.trim() || content.summary || '',
    skills: content.skills || [],
    experienceList: (content.experiences || []).map((item, index) => {
      const fromData = content.resumeData?.experience?.[index];
      const startDate = item.startDate || fromData?.startDate || '';
      const endDate = item.endDate || fromData?.endDate || '';
      const isCurrent = Boolean(item.isCurrent ?? fromData?.isCurrent);
      return {
        role: item.jobTitle || '',
        company: item.company || '',
        location: '',
        startDate: startDate || '',
        endDate: endDate || '',
        isCurrent,
        isInternship: Boolean(item.isInternship) || /\bintern(?:ship|s)?\b/i.test(item.jobTitle || ''),
        responsibilities: item.description
          ? item.description
              .split(/\n+/)
              .map((line) => line.replace(/^[-•*]\s*/, '').trim())
              .filter(Boolean)
          : [],
      };
    }),
    educationList: (content.education || []).map((item) => {
      const parsed = splitDegreeAndField(item.qualification || '');
      return {
        degree: parsed.degree,
        field: parsed.field,
        institution: item.institution || '',
        location: '',
        startDate: '',
        endDate: item.yearCompleted ? `${item.yearCompleted}-06` : '',
        isCurrent: false,
      };
    }),
    projectList: (content.projects || []).map((item, index) => {
      const fromData = content.resumeData?.projects?.[index];
      const { description, bullets, technologies: peeledTech } = splitProjectFields({
        description: item.description,
        bullets: item.bullets ?? fromData?.bullets,
        technologies: [
          ...(item.technologies || []),
          ...((fromData?.technologies as string[] | undefined) || []),
        ],
      });
      return {
        name: item.name || '',
        description,
        technologies: peeledTech,
        bullets: [...bullets],
      };
    }),
    certificationList: normalizeCertificationList(content.certifications).map((cert) => ({
      name: cert.name,
      issuer: cert.issuer || '',
      date: cert.date || '',
    })),
    achievementList: (content.achievements || [])
      .filter((ach) => {
        const blob = [ach.title, ach.organization, ach.description].filter(Boolean).join(' ');
        return blob.trim() && !/^\d+\s*of\s*\d+$/i.test(blob.replace(/[-–—]/g, '').replace(/\s+/g, ''));
      })
      .map((ach) => ({
      title: ach.title || '',
      organization: ach.organization || '',
      description: ach.description || '',
      date: ach.date || '',
    })),
    languages: parseLanguageSkills((content.languages || []).join(', ')),
  });
}
