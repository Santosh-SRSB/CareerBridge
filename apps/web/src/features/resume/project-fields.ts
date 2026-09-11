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
}): { description: string; bullets: string[] } {
  const explicitBullets = dedupeBulletList(
    Array.isArray(project.bullets) ? project.bullets.map((b) => String(b || '')) : [],
  );

  if (explicitBullets.length > 0) {
    const bulletKeys = new Set(explicitBullets.map(normalizeKey));
    const descLines = splitLines(project.description);
    const overviewLines = descLines.filter((line) => !bulletKeys.has(normalizeKey(line)));
    // If description was only the joined bullet list, clear overview.
    const description =
      overviewLines.length > 0
        ? overviewLines.join('\n')
        : descLines.length === 0
          ? String(project.description || '').trim() &&
            !bulletKeys.has(normalizeKey(String(project.description || '')))
            ? String(project.description || '').trim()
            : ''
          : '';
    // Never keep a bullet that is identical to the overview.
    const bullets = description
      ? explicitBullets.filter((b) => normalizeKey(b) !== normalizeKey(description))
      : explicitBullets;
    return { description, bullets: dedupeBulletList(bullets) };
  }

  const lines = splitLines(project.description);
  if (lines.length === 0) return { description: '', bullets: [] };
  if (lines.length === 1) return { description: lines[0], bullets: [] };
  // Legacy joined blob: first line = overview, remaining = bullets.
  return {
    description: lines[0],
    bullets: dedupeBulletList(lines.slice(1)),
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
  const { description, bullets } = splitProjectFields(project);
  return {
    name: project.name || '',
    description,
    bullets: [...bullets],
    technologies: [...(project.technologies || [])],
    url: project.url || '',
  };
}
