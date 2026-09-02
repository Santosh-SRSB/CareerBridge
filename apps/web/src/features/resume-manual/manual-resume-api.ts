import {
  ATS_PHOTO_TEMPLATES,
  ATS_PLAIN_TEMPLATES,
  resolveResumeTemplateId,
  type ResumeContent,
  type ResumeRecord,
} from '@careerbridge/shared';
import {
  analyzeResumeRole,
  careerGuidance,
  createResume,
  deleteResume,
  getResume,
  listResumes,
  rewriteResumeRole,
  updateResume,
} from '@/lib/api';

export type FriendResumeData = Record<string, unknown>;

export type FriendResume = {
  id: string;
  title: string;
  templateId: string;
  data: FriendResumeData;
  createdAt?: string;
  updatedAt?: string;
};

const TEMPLATE_CATALOG = [
  ...ATS_PHOTO_TEMPLATES.map((item) => ({
    id: item.id,
    name: item.name,
    category: 'with-photo',
    hasPhoto: true,
    atsFriendly: true,
    description: item.name,
  })),
  ...ATS_PLAIN_TEMPLATES.map((item) => ({
    id: item.id,
    name: item.name,
    category: 'without-photo',
    hasPhoto: false,
    atsFriendly: true,
    description: item.name,
  })),
];

function emptyFriendData(): FriendResumeData {
  return {
    fullName: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: '',
    photo: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    careerGaps: [],
    targetRole: '',
    jobDescription: '',
  };
}

function contentToFriendData(content: ResumeContent & { _manual?: boolean; data?: FriendResumeData }): FriendResumeData {
  if (content._manual && content.data && typeof content.data === 'object') {
    return { ...emptyFriendData(), ...content.data };
  }
  return {
    ...emptyFriendData(),
    fullName: content.fullName || '',
    email: content.email || '',
    phone: content.phone || '',
    location: content.city || '',
    summary: content.summary || '',
    skills: content.skills || [],
    experience: (content.experiences || []).map((item) => ({
      company: item.company,
      role: item.jobTitle,
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      bullets: item.description
        ? item.description
            .split(/\n|•/)
            .map((line) => line.trim())
            .filter(Boolean)
        : [],
    })),
    education: (content.education || []).map((item, index) => ({
      id: `education-${index}`,
      institution: item.institution || '',
      school: item.institution || '',
      degree: item.qualification || '',
      fieldOfStudy: '',
      endDate: item.yearCompleted ? String(item.yearCompleted) : '',
    })),
    projects: (content.projects || []).map((item) => ({
      name: item.name,
      title: item.name,
      description: item.description || '',
      technologies: [],
      bullets: [],
      url: '',
    })),
    certifications: (content.certifications || []).map((name) => ({
      name,
      issuer: '',
      date: '',
      url: '',
    })),
    photo: '',
  };
}

function friendDataToContent(data: FriendResumeData, includePhoto?: boolean): ResumeContent & {
  _manual: true;
  data: FriendResumeData;
} {
  const skills = Array.isArray(data.skills)
    ? data.skills.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const education = Array.isArray(data.education) ? data.education : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const certifications = Array.isArray(data.certifications) ? data.certifications : [];

  return {
    _manual: true,
    data: { ...emptyFriendData(), ...data },
    includePhoto: includePhoto ?? Boolean(data.photo),
    fullName: String(data.fullName || ''),
    city: data.location ? String(data.location) : null,
    phone: data.phone ? String(data.phone) : null,
    email: data.email ? String(data.email) : null,
    summary: String(data.summary || ''),
    skills,
    education: education.map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const year = Number.parseInt(String(row.endDate || ''), 10);
      return {
        qualification: String(row.degree || row.qualification || ''),
        institution: String(row.institution || row.school || '') || null,
        yearCompleted: Number.isFinite(year) ? year : null,
      };
    }),
    experiences: experience.map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const bullets = Array.isArray(row.bullets)
        ? row.bullets.map((line) => String(line || '').trim()).filter(Boolean)
        : [];
      return {
        company: String(row.company || ''),
        jobTitle: String(row.role || row.jobTitle || ''),
        description: bullets.length ? bullets.join('\n') : row.description ? String(row.description) : null,
        isInternship: false,
      };
    }),
    languages: [],
    certifications: certifications
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return String(row.name || '').trim();
      })
      .filter(Boolean),
    projects: projects.map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        name: String(row.name || row.title || ''),
        description: row.description ? String(row.description) : null,
      };
    }),
  };
}

function toFriendResume(record: ResumeRecord): FriendResume {
  const content = record.content as ResumeContent & { _manual?: boolean; data?: FriendResumeData };
  return {
    id: record.id,
    title: record.title,
    templateId: resolveResumeTemplateId(record.template),
    data: contentToFriendData(content),
    updatedAt: record.updatedAt,
  };
}

export const api = {
  templates: async () => TEMPLATE_CATALOG,

  listResumes: async () => {
    const records = await listResumes();
    return records.map(toFriendResume);
  },

  deleteResume: async (id: string) => {
    await deleteResume(id);
    return { deleted: true };
  },

  createResume: async (payload: {
    title?: string;
    templateId?: string;
    includePhoto?: boolean;
    data?: FriendResumeData;
  }) => {
    const includePhoto = payload.includePhoto ?? Boolean(payload.templateId?.startsWith('photo-'));
    const hasData = Boolean(payload.data && Object.keys(payload.data).length);
    const record = await createResume({
      title: payload.title || 'Untitled resume',
      template: payload.templateId,
      includePhoto,
      blank: !hasData,
      content: hasData ? friendDataToContent(payload.data as FriendResumeData, includePhoto) : undefined,
      targetJobTitle: payload.data?.targetRole ? String(payload.data.targetRole) : undefined,
    });
    return toFriendResume(record);
  },

  getResume: async (id: string) => {
    const record = await getResume(id);
    return toFriendResume(record);
  },

  updateResume: async (
    id: string,
    payload: { title?: string; templateId?: string; data?: FriendResumeData },
  ) => {
    const includePhoto =
      payload.templateId != null
        ? resolveResumeTemplateId(payload.templateId).startsWith('photo-')
        : undefined;
    const content =
      payload.data != null
        ? friendDataToContent(payload.data, includePhoto ?? Boolean(payload.data.photo))
        : undefined;
    const record = await updateResume(id, {
      title: payload.title,
      template: payload.templateId,
      content,
      targetJobTitle: payload.data?.targetRole ? String(payload.data.targetRole) : undefined,
      summary: payload.data?.summary != null ? String(payload.data.summary) : undefined,
    });
    return toFriendResume(record);
  },

  analyzeResume: async (payload: {
    resume: FriendResumeData;
    templateId?: string;
    targetRole: string;
    jobDescription?: string;
  }) => {
    return analyzeResumeRole({
      resume: payload.resume,
      templateId: payload.templateId,
      targetRole: payload.targetRole,
      jobDescription: payload.jobDescription || '',
    });
  },

  rewriteResume: async (
    id: string,
    payload: {
      resume: FriendResumeData;
      templateId?: string;
      targetRole: string;
      jobDescription?: string;
      analysis?: Record<string, unknown> | null;
    },
  ) => {
    const result = await rewriteResumeRole({
      resumeId: id,
      resume: payload.resume,
      templateId: payload.templateId,
      targetRole: payload.targetRole,
      jobDescription: payload.jobDescription || '',
      analysis: payload.analysis || null,
    });
    return {
      success: true,
      ...result,
      beforeScore: (result as { estimatedScoreBefore?: number }).estimatedScoreBefore ?? result.beforeScore,
      afterScore: (result as { estimatedScoreAfter?: number }).estimatedScoreAfter ?? result.afterScore,
    };
  },

  careerGuidance: async (id: string) => {
    return careerGuidance({ resumeId: String(id) });
  },
};
