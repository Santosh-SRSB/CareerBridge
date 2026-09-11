import type { ResumeContent } from './marketplace';

/**
 * Normalized resume JSON shape persisted alongside existing ResumeContent fields.
 * Additive — does not replace content_json columns or legacy structured fields.
 */
export type NormalizedResumeData = {
  contact: {
    fullName: string;
    email: string | null;
    phone: string | null;
    city: string | null;
  };
  summary: string;
  skills: string[];
  experience: Array<{
    company: string;
    jobTitle: string;
    description: string | null;
    isInternship: boolean;
  }>;
  education: Array<{
    qualification: string;
    institution: string | null;
    yearCompleted: number | null;
  }>;
  projects: Array<{ name: string; description: string | null; url?: string | null; bullets?: string[] }>;
  certifications: Array<{
    name: string;
    url?: string | null;
    issuer?: string | null;
    date?: string | null;
  }>;
  achievements?: Array<{
    title: string;
    organization?: string | null;
    description?: string | null;
    date?: string | null;
  }>;
  languages?: string[];
  careerGaps: Array<{
    startDate: string;
    endDate: string;
    reason: string;
    gapDays?: number;
  }>;
  links?: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
    website?: string;
  };
};

export type FieldProvenance = 'from_uploaded_resume' | 'added_manually' | 'ai_suggested';

/** Build the canonical resumeData blob from existing ResumeContent (and optional extras). */
export function normalizeResumeData(
  content: ResumeContent,
  extras?: {
    careerGaps?: NormalizedResumeData['careerGaps'];
    links?: NormalizedResumeData['links'];
    projectUrls?: Array<string | null | undefined>;
    certificationUrls?: Array<string | null | undefined>;
  },
): NormalizedResumeData {
  const certifications = (content.certifications || [])
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const name = entry.trim();
        return name ? { name, url: extras?.certificationUrls?.[index] ?? null, issuer: null, date: null } : null;
      }
      const name = String(entry?.name || '').trim();
      if (!name) return null;
      return {
        name,
        issuer: entry.issuer ?? null,
        date: entry.date ?? null,
        url: extras?.certificationUrls?.[index] ?? entry.url ?? null,
      };
    })
    .filter((row): row is { name: string; url: string | null; issuer: string | null; date: string | null } =>
      Boolean(row),
    );

  const projects = (content.projects || []).map((row, index) => ({
    name: row.name || '',
    description: row.description ?? null,
    url: extras?.projectUrls?.[index] ?? row.url ?? null,
    ...(Array.isArray(row.bullets) ? { bullets: [...row.bullets] } : {}),
  }));

  return {
    contact: {
      fullName: content.fullName || '',
      email: content.email ?? null,
      phone: content.phone ?? null,
      city: content.city ?? null,
    },
    summary: content.summary || '',
    skills: [...(content.skills || [])],
    experience: (content.experiences || []).map((row) => ({
      company: row.company || '',
      jobTitle: row.jobTitle || '',
      description: row.description ?? null,
      isInternship: Boolean(row.isInternship),
    })),
    education: (content.education || []).map((row) => ({
      qualification: row.qualification || '',
      institution: row.institution ?? null,
      yearCompleted: row.yearCompleted ?? null,
    })),
    projects,
    certifications,
    achievements: content.achievements || [],
    languages: [...(content.languages || [])],
    careerGaps: extras?.careerGaps || [],
    ...(extras?.links ? { links: extras.links } : {}),
  };
}

/**
 * Attach resumeData onto a content object without removing existing fields.
 * ADDITIVE: callers must keep writing legacy ResumeContent fields as before.
 */
export function withNormalizedResumeData<T extends ResumeContent>(
  content: T,
  extras?: Parameters<typeof normalizeResumeData>[1],
): T & { resumeData: NormalizedResumeData } {
  return {
    ...content,
    resumeData: normalizeResumeData(content, extras),
  };
}
