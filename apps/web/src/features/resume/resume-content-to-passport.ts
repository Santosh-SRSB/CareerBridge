import type { ResumeContent, SavePassportPayload } from '@careerbridge/shared';
import { normalizeResumeDateForStorage } from '@careerbridge/shared';

function storageDate(raw: string | null | undefined) {
  return normalizeResumeDateForStorage(raw) || undefined;
}

/** Map finalized resume content into Career Passport / profile payload (Path A step 12). */
export function mapResumeContentToPassportPayload(content: ResumeContent): SavePassportPayload {
  const parts = (content.fullName || '').trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || 'Candidate';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

  const experiences = content.experiences || [];
  const paidJobs = experiences.filter(
    (row) => !row.isInternship && Boolean(row.company?.trim() || row.jobTitle?.trim()),
  );
  const internships = experiences.filter(
    (row) => row.isInternship && Boolean(row.company?.trim() || row.jobTitle?.trim()),
  );
  const isExperienced = paidJobs.length > 0;

  return {
    firstName,
    lastName,
    city: content.city?.trim() || undefined,
    about: content.summary?.trim() || undefined,
    source: 'resume',
    experienceLevel: isExperienced ? 'experienced' : 'fresher',
    skills: (content.skills || []).map((s) => s.trim()).filter(Boolean),
    education: (content.education || [])
      .filter((row) => row.qualification?.trim())
      .map((row) => {
        const endDate = row.isCurrent ? undefined : storageDate(row.endDate);
        const yearCompleted = row.yearCompleted
          ? String(row.yearCompleted)
          : endDate?.match(/^\d{4}/)?.[0];
        return {
          qualification: row.qualification.trim(),
          institution: row.institution?.trim() || undefined,
          fieldOfStudy: row.fieldOfStudy?.trim() || undefined,
          yearCompleted,
          startDate: storageDate(row.startDate),
          endDate: endDate || (row.yearCompleted && !row.isCurrent ? `${row.yearCompleted}-06` : undefined),
        };
      }),
    experience: [...paidJobs, ...internships].map((row) => ({
      company: row.company?.trim() || undefined,
      jobTitle: row.jobTitle?.trim() || undefined,
      startDate: storageDate(row.startDate),
      endDate: row.isCurrent ? undefined : storageDate(row.endDate),
      stillInCompany: Boolean(row.isCurrent),
      description: row.description?.trim() || undefined,
      isInternship: Boolean(row.isInternship),
    })),
    projects: (content.projects || [])
      .filter((row) => row.name?.trim())
      .map((row) => {
        const overview = row.description?.trim() || '';
        const bullets = (row.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
        // Passport only has a single description field — keep overview, append bullets once.
        const description = [overview, ...bullets].filter(Boolean).join('\n') || undefined;
        return {
          title: row.name.trim(),
          description,
        };
      }),
  };
}
