/**
 * Reflow PDF-extracted "fake bullets": mid-sentence wraps that start with •/- 
 * into continuous text, while keeping genuine list items separate.
 * Pure heuristic — no LLM.
 *
 * Assumption: genuine list items usually end with terminal punctuation (.!?:;…).
 * Continuations are merged by default when the prior line does not end that way.
 */

const BULLET_RE = /^[-•*▪◦●]\s+/;
const NUMBERED_RE = /^\d+[.)]\s+/;

export function isBulletLine(line: string): boolean {
  const t = line.trim();
  return BULLET_RE.test(t) || NUMBERED_RE.test(t);
}

export function stripBulletMarker(line: string): string {
  return line.trim().replace(BULLET_RE, '').replace(NUMBERED_RE, '').trim();
}

function endsSentence(text: string): boolean {
  return /[.!?:;…]"?$/.test(text.trim());
}

/**
 * Default: if previous line has no terminal punctuation, the next bullet is a wrap
 * continuation (PDF mid-sentence wrap), including capitalized tech tokens like "React".
 */
function looksLikeWrapContinuation(prev: string, nextBare: string): boolean {
  if (!prev || !nextBare) return false;
  if (endsSentence(prev)) return false;
  return true;
}

/** Strong signals that a bullet starts a new list item — refuse merge even mid-sentence. */
function looksLikeNewListItem(bare: string): boolean {
  if (!bare) return false;
  if (/^job\s+profile\s+in\b/i.test(bare)) return true;
  if (
    /^(managed|handling|handled|worked|working|developed|built|led|guided|sourced|screening|assigned|conducted|implemented|designed|created|ensured|configured|debugged)\b/i.test(
      bare,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Returns lines with wrap-bullets merged into previous line (bullet marker removed on continuation).
 * Genuine new bullets stay as separate bullet lines.
 *
 * Guard: only merge bullet → bullet. Merging a bullet into a bare heading/date line
 * (e.g. "WORK EXPERIENCE" / "Jan 2021 - Present") caused over-merge in fixtures when
 * those lines lack terminal punctuation.
 */
export function reflowBulletWraps(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\u0000/g, ' ').trimEnd();
    if (!line.trim()) continue;

    if (!out.length) {
      out.push(line.trim());
      continue;
    }

    const prev = out[out.length - 1];
    const prevBare = stripBulletMarker(prev);
    const isBul = isBulletLine(line);
    const bare = isBul ? stripBulletMarker(line) : line.trim();

    // Only continue a prior bullet; never glue a bullet onto headings/dates/labels.
    if (
      isBul &&
      isBulletLine(prev) &&
      looksLikeWrapContinuation(prevBare, bare) &&
      !looksLikeNewListItem(bare)
    ) {
      // Merge into previous: drop the spurious bullet on the wrap line
      const joiner = /[A-Za-z]-$/.test(prevBare) ? '' : ' ';
      const mergedBare = `${prevBare}${joiner}${bare}`.replace(/\s+/g, ' ').trim();
      const keepBullet = isBulletLine(prev);
      out[out.length - 1] = keepBullet
        ? `${prev.match(BULLET_RE)?.[0] || prev.match(NUMBERED_RE)?.[0] || '• '}${mergedBare}`
        : mergedBare;
      continue;
    }

    out.push(line.trim());
  }
  return out;
}
