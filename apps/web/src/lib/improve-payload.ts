// Limits mirror ImproveSummaryDto / ImproveExperienceDto on the API.
export const IMPROVE_BULLET_MAX = 300;
export const IMPROVE_BULLETS_MAX = 12;
const IMPROVE_AVOID_MAX = 5;
const IMPROVE_AVOID_LEN = 2000;

function splitLongText(text: string, max: number): string[] {
  const out: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const piece = word.length > max ? word.slice(0, max) : word;
    if (!current) current = piece;
    else if (current.length + 1 + piece.length <= max) current += ` ${piece}`;
    else {
      out.push(current);
      current = piece;
    }
  }
  if (current) out.push(current);
  return out;
}

/** Long responsibility paragraphs are split at sentence (then word) boundaries so no text is cut mid-bullet. */
export function fitExperienceBullets(bullets: string[] = []): string[] {
  const out: string[] = [];
  for (const raw of bullets) {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (text.length <= IMPROVE_BULLET_MAX) {
      out.push(text);
      continue;
    }
    let chunk = '';
    for (const sentence of text.split(/(?<=[.!?;])\s+/)) {
      const parts = sentence.length > IMPROVE_BULLET_MAX ? splitLongText(sentence, IMPROVE_BULLET_MAX) : [sentence];
      for (const part of parts) {
        if (!chunk) chunk = part;
        else if (chunk.length + 1 + part.length <= IMPROVE_BULLET_MAX) chunk += ` ${part}`;
        else {
          out.push(chunk);
          chunk = part;
        }
      }
    }
    if (chunk) out.push(chunk);
  }
  return out.slice(0, IMPROVE_BULLETS_MAX);
}

export function fitAvoidList(avoid?: string[]): string[] | undefined {
  if (!avoid?.length) return undefined;
  const list = avoid
    .map((s) => s.trim().slice(0, IMPROVE_AVOID_LEN))
    .filter(Boolean)
    .slice(0, IMPROVE_AVOID_MAX);
  return list.length ? list : undefined;
}
