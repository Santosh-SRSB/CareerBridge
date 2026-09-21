import type { CandidateProfile } from '@careerbridge/shared';
import { resolveCandidateExperienceBand } from '@careerbridge/shared';

function splitLines(text?: string | null) {
  if (!text) return [] as string[];
  return text
    .split(/\n|•|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Matches STATUS / LEVEL chips on the dashboard boarding pass. */
export function isFresherProfile(profile: CandidateProfile) {
  return resolveCandidateExperienceBand(profile) === 'fresher';
}

const YEARS_OF_EXPERIENCE_CLAIM =
  /\b(?:with\s+|and\s+)?(?:over\s+|more than\s+)?\d+(?:\.\d+)?\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:hands[- ]?on\s+)?)?(?:experience|exp)\b/gi;

function claimsProfessionalTenure(text: string) {
  return /\b(?:with\s+|and\s+)?(?:over\s+|more than\s+)?\d+(?:\.\d+)?\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:hands[- ]?on\s+)?)?(?:experience|exp)\b/i.test(
    text,
  );
}

/** Resume "about" often claims years of experience even when the profile is Fresher. */
function alignSummaryForFresher(text: string): string | null {
  let cleaned = text
    .replace(YEARS_OF_EXPERIENCE_CLAIM, '')
    .replace(/\b(?:an?\s+)?experienced\s+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim();

  if (!cleaned || cleaned.length < 12) return null;
  if (claimsProfessionalTenure(cleaned)) return null;

  if (
    /^(full[- ]?stack|software|web|frontend|backend|data|product|senior|junior)\b/i.test(cleaned) &&
    !/\b(aspiring|fresher|seeking|looking|graduate|student|intern)\b/i.test(cleaned)
  ) {
    cleaned = `Aspiring ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }

  return cleaned;
}

function fallbackSummary(profile: CandidateProfile, fullName: string, title: string) {
  const skill = profile.skills?.[0]?.name;
  const fresher = isFresherProfile(profile);
  const roleBit = title
    ? fresher
      ? `aspiring ${title}`
      : title
    : fresher
      ? 'building a career'
      : 'building a career';
  const bits = [
    fullName || 'Candidate',
    roleBit,
    profile.city ? `based in ${profile.city}` : '',
    skill ? `with strengths in ${skill}` : '',
  ].filter(Boolean);
  return `${bits.join(' ')}.`;
}

export function resolvePassportSummary(
  profile: CandidateProfile,
  resumeSummary?: string | null,
) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  const title =
    profile.careerInterests?.[0] ||
    profile.experiences?.[0]?.jobTitle ||
    '';
  const fresher = isFresherProfile(profile);

  const candidates = [profile.about?.trim(), resumeSummary?.trim()].filter(Boolean) as string[];

  for (const raw of candidates) {
    if (!fresher) return raw;
    const aligned = alignSummaryForFresher(raw);
    if (aligned) return aligned;
  }

  return fallbackSummary(profile, fullName, title);
}

/** Maps Career Passport profile into the friend editor `resume.data` shape. */
export function passportToFriendResumeData(
  profile: CandidateProfile,
  options?: { includePhoto?: boolean },
) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  const title =
    profile.careerInterests?.[0] ||
    profile.experiences?.[0]?.jobTitle ||
    profile.experienceLevel ||
    '';
  const includePhoto = options?.includePhoto !== false;

  const education =
    (profile.education || []).length > 0
      ? (profile.education || []).map((item, index) => ({
          id: item.id || `education-${index}`,
          level: '',
          institution: item.institution || '',
          school: item.institution || '',
          degree: item.qualification || '',
          fieldOfStudy: item.fieldOfStudy || '',
          field: item.fieldOfStudy || '',
          location: '',
          startDate: item.startDate || profile.educationStart || '',
          endDate: item.endDate || (item.yearCompleted ? String(item.yearCompleted) : profile.educationEnd || ''),
          grade: '',
          gpa: '',
        }))
      : profile.highestEducation
        ? [
            {
              id: 'education-passport',
              level: '',
              institution: '',
              school: '',
              degree: profile.highestEducation,
              fieldOfStudy: '',
              field: '',
              location: '',
              startDate: profile.educationStart || '',
              endDate: profile.educationEnd || '',
              grade: '',
              gpa: '',
            },
          ]
        : [];

  const experience = (profile.experiences || []).map((item) => {
    const bullets = splitLines(item.description);
    return {
      company: item.company || '',
      role: item.jobTitle || '',
      location: '',
      startDate: item.startDate || '',
      endDate: item.stillInCompany ? '' : item.endDate || '',
      current: Boolean(item.stillInCompany || (!item.endDate && item.startDate)),
      bullets: bullets.length ? bullets : [''],
    };
  });

  const projects = (profile.projects || []).map((item, index) => {
    const lines = splitLines(item.description);
    return {
      id: item.id || `project-${index}`,
      name: item.title || '',
      title: item.title || '',
      description: item.description || '',
      link: item.url || '',
      url: item.url || '',
      technologies: [],
      bullets: lines.map((text, i) => ({ id: `project-${index}-b${i}`, text })),
      bulletPoints: lines,
      startDate: item.year ? String(item.year) : '',
      endDate: '',
    };
  });

  const certifications = (profile.certifications || []).map((item, index) => ({
    id: item.id || `cert-${index}`,
    name: item.name || '',
    issuer: item.issuer || '',
    date: item.year ? String(item.year) : '',
    url: '',
  }));

  const skills = (profile.skills || []).map((item) => item.name).filter(Boolean);

  return {
    fullName: fullName || '',
    title,
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.city || '',
    linkedin: profile.links?.linkedin || '',
    website: profile.links?.portfolio || profile.links?.website || '',
    github: profile.links?.github || '',
    photo: includePhoto && profile.photoUrl ? profile.photoUrl : null,
    summary: resolvePassportSummary(profile),
    targetRole: title,
    jobDescription: '',
    skills,
    experience,
    education,
    projects,
    certifications,
    careerGaps:
      profile.gapMonths && profile.gapMonths > 0
        ? [
            {
              id: 'career-gap-passport',
              type: profile.gapReason || 'Other',
              reason: profile.gapReason || '',
              startMonth: '',
              startYear: '',
              endMonth: '',
              endYear: '',
              current: false,
              description: profile.gapReason
                ? `Career break (~${profile.gapMonths} months): ${profile.gapReason}`
                : `Career break of about ${profile.gapMonths} months.`,
              activities: [''],
              skills: [''],
              certifications: [''],
              projects: [''],
              startDate: '',
              endDate: '',
            },
          ]
        : [],
  };
}
