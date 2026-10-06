export const RESUME_SUMMARY_MAX = 500;

/**
 * Normalises an AI-written summary and fits it to the resume limit by ending on a full sentence.
 * Returns null when the text is empty or cannot be shortened without cutting mid-sentence.
 */
export function fitResumeSummary(raw: unknown, max: number = RESUME_SUMMARY_MAX): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const lastEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  const cut = window.endsWith('.') || window.endsWith('!') || window.endsWith('?') ? max - 1 : lastEnd;
  if (cut < Math.floor(max / 2)) return null;
  return window.slice(0, cut + 1).trim();
}
