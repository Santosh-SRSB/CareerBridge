import type { ResumeContent, SavePassportPayload } from '@careerbridge/shared';

/** Map finalized resume content into Career Passport / profile payload (Path A step 12). */
export function mapResumeContentToPassportPayload(content: ResumeContent): SavePassportPayload {
  const parts = (content.fullName || '').trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || 'Candidate';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

  const experiences = content.experiences || [];
  const hasJobs = experiences.some((row) => Boolean(row.company?.trim() || row.jobTitle?.trim()));

  return {
    firstName,
    lastName,
    city: content.city?.trim() || undefined,
    about: content.summary?.trim() || undefined,
    source: 'resume',
    experienceLevel: hasJobs ? 'experienced' : 'fresher',
    skills: (content.skills || []).map((s) => s.trim()).filter(Boolean),
    education: (content.education || [])
      .filter((row) => row.qualification?.trim())
      .map((row) => ({
        qualification: row.qualification.trim(),
        institution: row.institution?.trim() || undefined,
        yearCompleted: row.yearCompleted ? String(row.yearCompleted) : undefined,
        endDate: row.yearCompleted ? `${row.yearCompleted}-06` : undefined,
      })),
    experience: experiences
      .filter((row) => row.company?.trim() || row.jobTitle?.trim())
      .map((row) => ({
        company: row.company?.trim() || undefined,
        jobTitle: row.jobTitle?.trim() || undefined,
        description: row.description?.trim() || undefined,
        isInternship: Boolean(row.isInternship),
      })),
    projects: (content.projects || [])
      .filter((row) => row.name?.trim())
      .map((row) => ({
        title: row.name.trim(),
        description: row.description?.trim() || undefined,
      })),
  };
}
