/**
 * Map between ParsedResumeSchema (API contract) and ResumeContent (internal).
 */

import type { ResumeContent } from '@careerbridge/shared';
import type { ParsedResumeSchema } from './parsed-resume.schema';
import { sanitizeResumeDate } from './layout-sanitize';

export function parsedSchemaToResumeContent(data: ParsedResumeSchema): ResumeContent {
  const links = data.personal_info.links || [];
  const findLink = (re: RegExp) => links.find((l) => re.test(l)) || null;

  return {
    fullName: data.personal_info.full_name || 'Candidate',
    city: data.personal_info.location || null,
    phone: data.personal_info.phone || null,
    email: data.personal_info.email || null,
    summary: data.summary || '',
    skills: [...data.skills],
    education: data.education.map((e) => {
      const yearNum = Number.parseInt(String(e.graduation_year).replace(/\D/g, '').slice(0, 4), 10);
      return {
        qualification: e.degree || '',
        institution: e.institution || null,
        yearCompleted: Number.isFinite(yearNum) && yearNum > 1950 ? yearNum : null,
      };
    }),
    experiences: data.work_experience.map((j) => {
      const end = sanitizeResumeDate(j.end_date);
      const isCurrent = /present|current|ongoing/i.test(j.end_date) || end === 'PRESENT';
      return {
        company: j.company || '',
        jobTitle: j.role_title || '',
        description: j.description_bullets.join('\n') || null,
        isInternship: /intern/i.test(j.role_title),
        startDate: sanitizeResumeDate(j.start_date) || null,
        endDate: isCurrent ? null : end || null,
        isCurrent,
        responsibilities: [...j.description_bullets],
      };
    }),
    languages: [],
    projects: data.projects.map((p) => ({
      name: p.title || '',
      description: p.description || null,
      url: p.link || null,
    })),
    personal: {
      fullName: data.personal_info.full_name || undefined,
      email: data.personal_info.email || undefined,
      phone: data.personal_info.phone || undefined,
      city: data.personal_info.location || undefined,
    },
    links: {
      linkedin: findLink(/linkedin/i) || undefined,
      github: findLink(/github/i) || undefined,
      portfolio: findLink(/portfolio/i) || undefined,
      website: links.find((l) => /^https?:\/\//i.test(l) && !/linkedin|github/i.test(l)) || undefined,
    },
  };
}

export function resumeContentToParsedSchema(content: ResumeContent): ParsedResumeSchema {
  const linkVals = [
    content.links?.linkedin,
    content.links?.github,
    content.links?.portfolio,
    content.links?.website,
    content.personal?.linkedin,
    content.personal?.github,
    content.personal?.portfolio,
  ].filter((v): v is string => Boolean(v && String(v).trim()));

  return {
    personal_info: {
      full_name: content.fullName || content.personal?.fullName || '',
      email: content.email || content.personal?.email || '',
      phone: content.phone || content.personal?.phone || '',
      location: content.city || content.personal?.city || '',
      links: [...new Set(linkVals)],
    },
    summary: content.summary || '',
    work_experience: (content.experiences || []).map((j) => {
      const bullets =
        Array.isArray(j.responsibilities) && j.responsibilities.length
          ? j.responsibilities
          : String(j.description || '')
              .split(/\n|•/)
              .map((s) => s.trim())
              .filter(Boolean);
      return {
        company: j.company || '',
        role_title: j.jobTitle || '',
        start_date: j.startDate || '',
        end_date: j.isCurrent ? 'PRESENT' : j.endDate || '',
        description_bullets: bullets,
      };
    }),
    education: (content.education || []).map((e) => ({
      degree: e.qualification || '',
      institution: e.institution || '',
      graduation_year: e.yearCompleted != null ? String(e.yearCompleted) : e.endDate || '',
    })),
    skills: [...(content.skills || [])],
    projects: (content.projects || []).map((p) => ({
      title: p.name || '',
      description: p.description || '',
      link: p.url || '',
    })),
  };
}
