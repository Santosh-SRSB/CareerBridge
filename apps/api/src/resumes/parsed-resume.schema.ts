/**
 * Strict parse-resume JSON schema (API contract for POST /api/v1/parse-resume).
 * Coercion is tolerant of partial / malformed LLM output.
 */

export type ParsedPersonalInfo = {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
};

export type ParsedWorkExperience = {
  company: string;
  role_title: string;
  start_date: string;
  end_date: string;
  description_bullets: string[];
};

export type ParsedEducation = {
  degree: string;
  institution: string;
  graduation_year: string;
};

export type ParsedProject = {
  title: string;
  description: string;
  link: string;
};

export type ParsedResumeSchema = {
  personal_info: ParsedPersonalInfo;
  summary: string;
  work_experience: ParsedWorkExperience[];
  education: ParsedEducation[];
  skills: string[];
  projects: ParsedProject[];
};

export type ParsedResumeMeta = {
  extractor: string;
  layoutMode: 'spatial-text' | 'heuristic-text' | 'llm-text' | 'llm-multimodal' | 'fallback';
  partial: boolean;
  warnings: string[];
  groundingRejected?: Array<{ field: string; value: string; reason: string }>;
};

export type ParsedResumeResponse = {
  ok: boolean;
  data: ParsedResumeSchema;
  meta: ParsedResumeMeta;
  /** Full sanitized source text used for grounding (may be large). */
  rawText?: string;
  rawTextPreview?: string;
  error?: string;
};

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  return '';
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) {
    if (typeof v === 'string' && v.trim()) {
      return v
        .split(/[,|;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }
  return v.map(asString).filter(Boolean);
}

function emptySchema(): ParsedResumeSchema {
  return {
    personal_info: {
      full_name: '',
      email: '',
      phone: '',
      location: '',
      links: [],
    },
    summary: '',
    work_experience: [],
    education: [],
    skills: [],
    projects: [],
  };
}

/**
 * Coerce arbitrary JSON into ParsedResumeSchema.
 * Never throws — returns empty defaults + warnings for bad shapes.
 */
export function coerceParsedResumeSchema(raw: unknown): {
  data: ParsedResumeSchema;
  warnings: string[];
  partial: boolean;
} {
  const warnings: string[] = [];
  const base = emptySchema();

  if (!raw || typeof raw !== 'object') {
    warnings.push('payload_not_object');
    return { data: base, warnings, partial: true };
  }

  const obj = raw as Record<string, unknown>;

  // Accept both snake_case contract and a few legacy camelCase aliases.
  const personalRaw =
    (obj.personal_info as Record<string, unknown> | undefined) ||
    (obj.personalInfo as Record<string, unknown> | undefined) ||
    {};

  base.personal_info = {
    full_name: asString(personalRaw.full_name || personalRaw.fullName || obj.full_name || obj.fullName),
    email: asString(personalRaw.email || obj.email),
    phone: asString(personalRaw.phone || obj.phone),
    location: asString(personalRaw.location || personalRaw.city || obj.location || obj.city),
    links: asStringArray(personalRaw.links || obj.links),
  };

  base.summary = asString(obj.summary || obj.about);

  const workRaw = obj.work_experience || obj.workExperience || obj.experience || obj.experiences;
  if (Array.isArray(workRaw)) {
    base.work_experience = workRaw.map((row, i) => {
      if (!row || typeof row !== 'object') {
        warnings.push(`work_experience[${i}]_invalid`);
        return {
          company: '',
          role_title: '',
          start_date: '',
          end_date: '',
          description_bullets: [],
        };
      }
      const r = row as Record<string, unknown>;
      const bullets =
        r.description_bullets ||
        r.descriptionBullets ||
        r.responsibilities ||
        (typeof r.description === 'string' && r.description
          ? String(r.description)
              .split(/\n|•/)
              .map((s) => s.trim())
              .filter(Boolean)
          : []);
      return {
        company: asString(r.company),
        role_title: asString(r.role_title || r.roleTitle || r.jobTitle || r.title),
        start_date: asString(r.start_date || r.startDate),
        end_date: asString(r.end_date || r.endDate),
        description_bullets: asStringArray(bullets),
      };
    });
  } else if (workRaw != null) {
    warnings.push('work_experience_not_array');
  }

  const eduRaw = obj.education;
  if (Array.isArray(eduRaw)) {
    base.education = eduRaw.map((row, i) => {
      if (!row || typeof row !== 'object') {
        warnings.push(`education[${i}]_invalid`);
        return { degree: '', institution: '', graduation_year: '' };
      }
      const r = row as Record<string, unknown>;
      return {
        degree: asString(r.degree || r.qualification),
        institution: asString(r.institution),
        graduation_year: asString(
          r.graduation_year || r.graduationYear || r.yearCompleted || r.year,
        ),
      };
    });
  } else if (eduRaw != null) {
    warnings.push('education_not_array');
  }

  base.skills = asStringArray(obj.skills);

  const projRaw = obj.projects;
  if (Array.isArray(projRaw)) {
    base.projects = projRaw.map((row, i) => {
      if (!row || typeof row !== 'object') {
        warnings.push(`projects[${i}]_invalid`);
        return { title: '', description: '', link: '' };
      }
      const r = row as Record<string, unknown>;
      return {
        title: asString(r.title || r.name),
        description: asString(r.description),
        link: asString(r.link || r.url),
      };
    });
  } else if (projRaw != null) {
    warnings.push('projects_not_array');
  }

  const hasIdentity = Boolean(base.personal_info.full_name || base.personal_info.email);
  const hasBody =
    base.work_experience.some((w) => w.company || w.role_title) ||
    base.education.some((e) => e.degree || e.institution) ||
    base.skills.length > 0 ||
    Boolean(base.summary);
  const partial = !hasIdentity || !hasBody || warnings.length > 0;

  return { data: base, warnings, partial };
}

export function isParsedResumeSchemaMostlyEmpty(data: ParsedResumeSchema): boolean {
  return (
    !data.personal_info.full_name &&
    !data.personal_info.email &&
    !data.summary &&
    !data.work_experience.length &&
    !data.education.length &&
    !data.skills.length &&
    !data.projects.length
  );
}
