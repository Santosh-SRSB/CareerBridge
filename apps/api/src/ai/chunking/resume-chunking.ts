import type { ResumeContent } from '@careerbridge/shared';
import { CHUNKING_POLICY, estimateTokens } from './chunking-policy';

export type ChunkMetadata = {
  companyName?: string | null;
  roleTitle?: string | null;
  projectName?: string | null;
  dates?: string | null;
  sourceHash?: string | null;
};

export type SemanticChunk = {
  section: string;
  subsection: string | null;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: ChunkMetadata;
};

type Piece = {
  section: string;
  subsection: string | null;
  text: string;
  metadata: ChunkMetadata;
};

/**
 * Semantic-first chunking.
 * A section or logical entity stays one chunk while it is at most semanticMaxTokens.
 * Fixed 450/50 splitting is only the overflow after that entity cannot be split further.
 */
export function chunkResumeContent(content: ResumeContent): SemanticChunk[] {
  const pieces: Piece[] = [];

  const summary = (content.summary || '').trim();
  if (summary) {
    pieces.push(...expandPiece({ section: 'Summary', subsection: null, text: summary, metadata: {} }));
  }

  const skills = (content.skills || []).map((skill) => skill.trim()).filter(Boolean);
  if (skills.length) {
    pieces.push(
      ...expandList('Skills', 'Skills', skills, {}),
    );
  }

  const experiences = content.experiences || [];
  if (experiences.length) {
    const items = experiences
      .map((row) => {
        const dates = [row.startDate, row.isCurrent ? 'Present' : row.endDate].filter(Boolean).join(' – ');
        const text = [
          row.company,
          row.jobTitle,
          dates,
          row.isInternship ? 'Internship' : '',
          row.description || '',
        ]
          .filter(Boolean)
          .join('\n');
        return {
          subsection: [row.company, row.jobTitle].filter(Boolean).join(' — ') || 'Role',
          text,
          metadata: {
            companyName: row.company || null,
            roleTitle: row.jobTitle || null,
            dates: dates || null,
          },
        };
      })
      .filter((item) => item.text.trim());
    pieces.push(...expandEntities('Experience', items));
  }

  const education = content.education || [];
  if (education.length) {
    const items = education
      .map((row) => ({
        subsection: [row.qualification, row.institution].filter(Boolean).join(' — ') || 'Education',
        text: [row.qualification, row.institution, row.yearCompleted ? String(row.yearCompleted) : '']
          .filter(Boolean)
          .join('\n'),
        metadata: {},
      }))
      .filter((item) => item.text.trim());
    pieces.push(...expandEntities('Education', items));
  }

  const projects = content.projects || [];
  if (projects.length) {
    const items = projects
      .map((row) => ({
        subsection: row.name || 'Project',
        text: [row.name, row.description || '', (row.bullets || []).join('\n'), (row.technologies || []).join(', '), row.url || '']
          .filter(Boolean)
          .join('\n'),
        metadata: { projectName: row.name || null },
      }))
      .filter((item) => item.text.trim());
    pieces.push(...expandEntities('Projects', items));
  }

  const certifications = content.certifications || [];
  if (certifications.length) {
    const items = certifications
      .map((row) => {
        if (typeof row === 'string') {
          return { subsection: row, text: row, metadata: {} };
        }
        const text = [row.name, row.issuer, row.date].filter(Boolean).join('\n');
        return { subsection: row.name || 'Certification', text, metadata: {} };
      })
      .filter((item) => item.text.trim());
    pieces.push(...expandEntities('Certifications', items));
  }

  const achievements = content.achievements || [];
  if (achievements.length) {
    const items = achievements
      .map((row) => ({
        subsection: row.title || 'Achievement',
        text: [row.title, row.organization, row.date, row.description].filter(Boolean).join('\n'),
        metadata: {},
      }))
      .filter((item) => item.text.trim());
    pieces.push(...expandEntities('Achievements', items));
  }

  return pieces.map((piece, chunkIndex) => ({
    section: piece.section,
    subsection: piece.subsection,
    chunkIndex,
    content: piece.text,
    tokenCount: estimateTokens(piece.text),
    metadata: piece.metadata,
  }));
}

export type JobChunkInput = {
  title: string;
  description: string;
  city?: string | null;
  category?: string | null;
  requiredSkills?: string[];
  preferredSkills?: string[];
  experience?: string | null;
  educationMin?: string | null;
};

/** Same policy for a job description: one section when small, else logical blocks, else fixed overflow. */
export function chunkJobDescription(job: JobChunkInput): SemanticChunk[] {
  const pieces: Piece[] = [];
  const about = [job.title, job.category, job.city, job.experience, job.educationMin].filter(Boolean).join('\n');
  if (about.trim()) {
    pieces.push(...expandPiece({ section: 'Overview', subsection: null, text: about, metadata: {} }));
  }
  if (job.requiredSkills?.length) {
    pieces.push(...expandList('Required skills', 'Required skills', job.requiredSkills, {}));
  }
  if (job.preferredSkills?.length) {
    pieces.push(...expandList('Preferred skills', 'Preferred skills', job.preferredSkills, {}));
  }
  const description = (job.description || '').trim();
  if (description) {
    pieces.push(
      ...expandPiece({
        section: 'Responsibilities',
        subsection: null,
        text: description,
        metadata: {},
      }),
    );
  }
  return pieces.map((piece, chunkIndex) => ({
    section: piece.section,
    subsection: piece.subsection,
    chunkIndex,
    content: piece.text,
    tokenCount: estimateTokens(piece.text),
    metadata: piece.metadata,
  }));
}

function expandEntities(
  section: string,
  items: Array<{ subsection: string; text: string; metadata: ChunkMetadata }>,
): Piece[] {
  if (!items.length) return [];
  const combined = items.map((item) => item.text).join('\n\n');
  if (estimateTokens(combined) <= CHUNKING_POLICY.semanticMaxTokens) {
    return [{ section, subsection: null, text: combined, metadata: {} }];
  }
  const out: Piece[] = [];
  for (const item of items) {
    out.push(
      ...expandPiece({
        section,
        subsection: item.subsection,
        text: item.text,
        metadata: item.metadata,
      }),
    );
  }
  return out;
}

function expandList(section: string, label: string, values: string[], metadata: ChunkMetadata): Piece[] {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (!unique.length) return [];
  const groups: string[] = [];
  let current: string[] = [];
  for (const value of unique) {
    const next = [...current, value];
    const text = `${label}\n${next.join(', ')}`;
    if (estimateTokens(text) > CHUNKING_POLICY.semanticMaxTokens && current.length) {
      groups.push(`${label}\n${current.join(', ')}`);
      current = [value];
    } else {
      current = next;
    }
  }
  if (current.length) groups.push(`${label}\n${current.join(', ')}`);
  const pieces: Piece[] = [];
  groups.forEach((text, index) => {
    pieces.push(
      ...expandPiece({
        section,
        subsection: groups.length > 1 ? `${label} ${index + 1}` : null,
        text,
        metadata,
      }),
    );
  });
  return pieces;
}

function expandPiece(piece: Piece): Piece[] {
  if (estimateTokens(piece.text) <= CHUNKING_POLICY.semanticMaxTokens) {
    return [piece];
  }
  return splitFixed(piece.text).map((text, index) => ({
    ...piece,
    subsection: piece.subsection ? `${piece.subsection} (${index + 1})` : `Part ${index + 1}`,
    text,
  }));
}

/** Fixed fallback. Every word is kept. Later chunks overlap the previous tail. */
export function splitFixed(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const sizeChars = CHUNKING_POLICY.fallbackChunkSize * 4;
  const overlapChars = CHUNKING_POLICY.fallbackOverlap * 4;
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    let end = start;
    let chars = 0;
    while (end < words.length) {
      const add = words[end].length + (chars > 0 ? 1 : 0);
      if (chars + add > sizeChars && end > start) break;
      chars += add;
      end += 1;
    }
    if (end === start) end = start + 1;
    chunks.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    let back = end;
    let overlap = 0;
    while (back > start && overlap < overlapChars) {
      back -= 1;
      overlap += words[back].length + 1;
    }
    const next = Math.max(back, start + 1);
    start = next >= end ? end : next;
  }
  return chunks;
}
