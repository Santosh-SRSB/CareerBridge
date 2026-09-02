import type { CandidateProfile } from '@careerbridge/shared';

function splitLines(text?: string | null) {
  if (!text) return [] as string[];
  return text
    .split(/\n|•|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function fallbackSummary(profile: CandidateProfile, fullName: string, title: string) {
  if (profile.about?.trim()) return profile.about.trim();
  const skill = profile.skills?.[0]?.name;
  const bits = [
    fullName || 'Candidate',
    title ? `aspiring ${title}` : 'building a career',
    profile.city ? `based in ${profile.city}` : '',
    skill ? `with strengths in ${skill}` : '',
  ].filter(Boolean);
  return `${bits.join(' ')}.`;
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
    website: profile.links?.github || profile.links?.portfolio || '',
    photo: includePhoto && profile.photoUrl ? profile.photoUrl : null,
    summary: fallbackSummary(profile, fullName, title),
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
