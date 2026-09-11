import type { ResumeContent } from '@careerbridge/shared';
import type { StructuredResumeDraft } from '../ai/ai.types';
import { parseExtractedResumeText } from './parse-extracted-resume';

function richness(content: Pick<ResumeContent, 'skills' | 'education' | 'experiences' | 'projects'>): number {
  return (
    (content.skills?.length || 0) +
    (content.education?.length || 0) * 2 +
    (content.experiences?.length || 0) * 3 +
    (content.projects?.length || 0) * 3 +
    (content.experiences || []).reduce((n, row) => n + (row.description?.length || 0), 0) / 80 +
    (content.projects || []).reduce((n, row) => n + (row.description?.length || 0), 0) / 80
  );
}

function pickRicher<T>(ai: T[], heuristic: T[], aiRich: number, heuristicRich: number): T[] {
  if (!ai.length) return heuristic;
  if (!heuristic.length) return ai;
  // Prefer AI when it captured at least as much structure; otherwise keep heuristic.
  return aiRich >= heuristicRich * 0.75 ? ai : heuristic;
}

/**
 * Merge AI-structured draft with heuristic parse (phone/email/languages/certs often better from heuristic).
 */
export function mergeStructuredIntoResumeContent(
  draft: StructuredResumeDraft,
  fallback: ResumeContent,
): ResumeContent {
  const fullName =
    [draft.firstName, draft.lastName].filter((part) => String(part || '').trim()).join(' ').trim() ||
    fallback.fullName;

  const educationFromAi =
    Array.isArray(draft.education) && draft.education.length
      ? draft.education
          .map((row) => {
            const yearRaw = String(row.yearCompleted || '').trim();
            const year = Number.parseInt(yearRaw.replace(/\D/g, '').slice(0, 4), 10);
            const qualification = [row.qualification, row.fieldOfStudy]
              .map((v) => String(v || '').trim())
              .filter(Boolean)
              .join(' in ');
            return {
              qualification: qualification || String(row.qualification || '').trim(),
              institution: String(row.institution || '').trim() || null,
              yearCompleted: Number.isFinite(year) ? year : null,
            };
          })
          .filter((row) => row.qualification || row.institution)
      : [];

  const experiencesFromAi =
    Array.isArray(draft.experience) && draft.experience.length
      ? draft.experience
          .map((row) => ({
            company: String(row.company || '').trim(),
            jobTitle: String(row.jobTitle || '').trim(),
            description: String(row.description || '').trim() || null,
            isInternship: Boolean(row.isInternship),
          }))
          .filter((row) => row.company || row.jobTitle || row.description)
      : [];

  const projectsFromAi =
    Array.isArray(draft.projects) && draft.projects.length
      ? draft.projects
          .map((row) => ({
            name: String(row.title || '').trim(),
            description: String(row.description || '').trim() || null,
            url: String(row.url || '').trim() || null,
          }))
          .filter((row) => row.name)
      : [];

  const skillsFromAi =
    Array.isArray(draft.skills) && draft.skills.length
      ? draft.skills.map((s) => String(s || '').trim()).filter(Boolean)
      : [];

  const languagesFromAi =
    Array.isArray(draft.languages) && draft.languages.length
      ? draft.languages.map((s) => String(s || '').trim()).filter(Boolean)
      : [];

  const certificationsFromAi =
    Array.isArray(draft.certifications) && draft.certifications.length
      ? draft.certifications
          .map((row) => {
            const name = String(row?.name || '').trim();
            if (!name) return null;
            return {
              name,
              issuer: String(row?.issuer || '').trim() || null,
              date: String(row?.date || '').trim() || null,
            };
          })
          .filter((row): row is { name: string; issuer: string | null; date: string | null } => Boolean(row))
      : [];

  const achievementsFromAi =
    Array.isArray(draft.achievements) && draft.achievements.length
      ? draft.achievements
          .map((row) => {
            const title = String(row?.title || '').trim();
            if (!title) return null;
            return {
              title,
              organization: String(row?.organization || '').trim() || null,
              description: String(row?.description || '').trim() || null,
              date: String(row?.date || '').trim() || null,
            };
          })
          .filter(
            (
              row,
            ): row is {
              title: string;
              organization: string | null;
              description: string | null;
              date: string | null;
            } => Boolean(row),
          )
      : [];

  const aiSlice = {
    skills: skillsFromAi,
    education: educationFromAi,
    experiences: experiencesFromAi,
    projects: projectsFromAi,
  };
  const heuristicProjects = (fallback.projects || []).map((row) => ({
    name: row.name,
    description: row.description || null,
    url: row.url ?? null,
  }));
  const heuristicSlice = {
    skills: fallback.skills || [],
    education: fallback.education || [],
    experiences: fallback.experiences || [],
    projects: heuristicProjects,
  };
  const aiRich = richness(aiSlice);
  const heuristicRich = richness(heuristicSlice);

  const skills = pickRicher(skillsFromAi, heuristicSlice.skills, skillsFromAi.length, heuristicSlice.skills.length);
  // Prefer union of skills when both have content (deduped).
  const mergedSkills =
    skillsFromAi.length && heuristicSlice.skills.length
      ? [
          ...new Set(
            [...skillsFromAi, ...heuristicSlice.skills].map((s) => s.trim()).filter(Boolean),
          ),
        ]
      : skills;

  return {
    fullName: fullName || fallback.fullName || 'Candidate',
    city: String(draft.city || '').trim() || fallback.city,
    phone: fallback.phone,
    email: fallback.email,
    summary: String(draft.about || '').trim() || fallback.summary,
    skills: mergedSkills,
    education: pickRicher(educationFromAi, heuristicSlice.education, aiRich, heuristicRich),
    experiences: pickRicher(experiencesFromAi, heuristicSlice.experiences, aiRich, heuristicRich),
    languages: languagesFromAi.length ? languagesFromAi : fallback.languages || [],
    certifications: certificationsFromAi.length
      ? certificationsFromAi
      : fallback.certifications || [],
    achievements: achievementsFromAi.length ? achievementsFromAi : fallback.achievements || [],
    projects: pickRicher(projectsFromAi, heuristicProjects, aiRich, heuristicRich),
    includePhoto: false,
  };
}

/** Prefer AI structure when available; always fall back to deterministic parse. */
export async function parseResumeTextWithOptionalAi(
  rawText: string,
  structureFn: (text: string) => Promise<StructuredResumeDraft | null>,
): Promise<ResumeContent> {
  const heuristic = parseExtractedResumeText(rawText);
  try {
    const structured = await structureFn(rawText);
    if (structured) return mergeStructuredIntoResumeContent(structured, heuristic);
  } catch {
    /* use heuristic */
  }
  return heuristic;
}
