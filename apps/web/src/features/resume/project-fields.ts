/**
 * Keep project overview (description) and bullet points independent.
 * Prevents the save→load round-trip that concatenates bullets into description
 * and then splits them back into both fields (causing 2x/3x duplication).
 */

function splitLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const TECH_LABEL =
  /^(?:technologies?|tech\s*stack|tools?(?:\s+used)?|stack)\s*[:|\-–—]\s*(.+)$/i;
const TECH_TRAILING =
  /^(.*?)(?:\s+)(?:technologies?|tech\s*stack|tools?(?:\s+used)?|stack)\s*[:|\-–—]\s*(.+)$/i;

function splitTechTokens(raw: string): string[] {
  return raw
    .split(/[,;/|•]+/)
    .map((item) => item.replace(/\.$/, '').trim())
    .filter((item) => item.length > 1 && item.length < 48);
}

/**
 * Pull "Technologies: React, Node…" out of project description into chips.
 * Leaves overview text without the technologies line.
 */
export function peelProjectTechnologies(
  description: string | null | undefined,
  existing: string[] = [],
): { description: string; technologies: string[] } {
  const found: string[] = [];
  const kept: string[] = [];

  for (const line of String(description || '').split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push(line);
      continue;
    }
    const labeled = trimmed.match(TECH_LABEL);
    if (labeled?.[1]) {
      found.push(...splitTechTokens(labeled[1]));
      continue;
    }
    const trailing = trimmed.match(TECH_TRAILING);
    if (trailing?.[2] && splitTechTokens(trailing[2]).length > 0) {
      if (trailing[1]?.trim()) kept.push(trailing[1].trim());
      found.push(...splitTechTokens(trailing[2]));
      continue;
    }
    kept.push(line);
  }

  let nextDescription = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const endMatch = nextDescription.match(
    /\b(?:technologies?|tech\s*stack|tools?(?:\s+used)?|stack)\s*[:|\-–—]\s*([^.]+)$/i,
  );
  if (endMatch?.[1] && splitTechTokens(endMatch[1]).length > 0) {
    found.push(...splitTechTokens(endMatch[1]));
    nextDescription = nextDescription.slice(0, endMatch.index).trim().replace(/[.,;:\s]+$/, '');
  }

  const technologies = [
    ...new Set(
      [...existing, ...found]
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  ];

  return { description: nextDescription, technologies };
}

/** Drop exact duplicates while preserving order. */
export function dedupeBulletList(bullets: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of bullets) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const key = normalizeKey(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/**
 * Split stored project fields into overview + bullets without duplicating text.
 * Prefer explicit `bullets` when present; otherwise parse legacy joined description.
 */
export function splitProjectFields(project: {
  description?: string | null;
  bullets?: string[] | null;
  technologies?: string[] | null;
}): { description: string; bullets: string[]; technologies: string[] } {
  const explicitBullets = dedupeBulletList(
    Array.isArray(project.bullets) ? project.bullets.map((b) => String(b || '')) : [],
  );

  let description = '';
  let bullets: string[] = [];

  if (explicitBullets.length > 0) {
    const bulletKeys = new Set(explicitBullets.map(normalizeKey));
    const descLines = splitLines(project.description);
    const overviewLines = descLines.filter((line) => !bulletKeys.has(normalizeKey(line)));
    // If description was only the joined bullet list, clear overview.
    description =
      overviewLines.length > 0
        ? overviewLines.join('\n')
        : descLines.length === 0
          ? String(project.description || '').trim() &&
            !bulletKeys.has(normalizeKey(String(project.description || '')))
            ? String(project.description || '').trim()
            : ''
          : '';
    // Never keep a bullet that is identical to the overview.
    bullets = description
      ? explicitBullets.filter((b) => normalizeKey(b) !== normalizeKey(description))
      : explicitBullets;
    bullets = dedupeBulletList(bullets);
  } else {
    const lines = splitLines(project.description);
    if (lines.length === 0) {
      description = '';
      bullets = [];
    } else if (lines.length === 1) {
      description = lines[0];
      bullets = [];
    } else {
      // Legacy joined blob: first line = overview, remaining = bullets.
      description = lines[0];
      bullets = dedupeBulletList(lines.slice(1));
    }
  }

  const peeled = peelProjectTechnologies(description, project.technologies || []);
  const techKeys = new Set(peeled.technologies.map(normalizeKey));
  return {
    description: peeled.description,
    bullets: bullets.filter((b) => !techKeys.has(normalizeKey(b)) && !TECH_LABEL.test(b.trim())),
    technologies: peeled.technologies,
  };
}

/** Deep-clone project fields for a new resume (no shared references). */
export function cloneProjectFields(project: {
  name?: string;
  description?: string | null;
  bullets?: string[] | null;
  technologies?: string[] | null;
  url?: string | null;
}) {
  const { description, bullets, technologies } = splitProjectFields(project);
  return {
    name: project.name || '',
    description,
    bullets: [...bullets],
    technologies: [...technologies],
    url: project.url || '',
  };
}
