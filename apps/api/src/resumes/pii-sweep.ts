/**
 * Document-wide PII / personal-field sweep — pure heuristic.
 * Pulls labeled personal facts from anywhere in the text and strips them
 * from other section streams so they do not leak into skills/experience.
 */

export type SweptPersonal = {
  fullName: string | null;
  fathersName: string | null;
  dateOfBirth: string | null;
  maritalStatus: string | null;
  gender: string | null;
  nationality: string | null;
  address: string | null;
  cityHint: string | null;
  languagesLine: string | null;
  strippedLines: string[];
};

type SweptScalarKey = Exclude<keyof SweptPersonal, 'strippedLines'>;

const LABEL_PATTERNS: Array<{ key: SweptScalarKey; re: RegExp }> = [
  { key: 'fathersName', re: /^(?:father\s*['’]?\s*s?\s*name)\s*[:|\-–]\s*(.+)$/i },
  { key: 'dateOfBirth', re: /^(?:date\s*of\s*birth|d\.?o\.?b\.?)\s*[:|\-–]\s*(.+)$/i },
  { key: 'maritalStatus', re: /^(?:marital\s*status)\s*[:|\-–]\s*(.+)$/i },
  { key: 'gender', re: /^(?:gender|sex)\s*[:|\-–]\s*(.+)$/i },
  { key: 'nationality', re: /^(?:nationality)\s*[:|\-–]\s*(.+)$/i },
  { key: 'address', re: /^(?:permanent\s*address|present\s*address|address|residential\s*address)\s*[:|\-–]\s*(.+)$/i },
  { key: 'languagesLine', re: /^(?:languages?\s*known|known\s*languages?|mother\s*tongue)\s*[:|\-–]\s*(.+)$/i },
];

const INLINE_PII_CHUNK =
  /(?:father\s*['’]?\s*s?\s*name|date\s*of\s*birth|d\.?o\.?b\.?|marital\s*status|permanent\s*address|present\s*address|\bname)\s*[:|\-–]\s*[^,|;]+/gi;

export function sweepPersonalFromLines(lines: string[]): SweptPersonal {
  const result: SweptPersonal = {
    fullName: null,
    fathersName: null,
    dateOfBirth: null,
    maritalStatus: null,
    gender: null,
    nationality: null,
    address: null,
    cityHint: null,
    languagesLine: null,
    strippedLines: [],
  };

  const addressBuffer: string[] = [];
  let capturingAddress = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    let matchedLabel = false;
    for (const { key, re } of LABEL_PATTERNS) {
      const m = line.match(re);
      if (!m?.[1]) continue;
      matchedLabel = true;
      const value = m[1].trim();
      if (key === 'address') {
        result.address = value;
        capturingAddress = true;
        addressBuffer.length = 0;
        addressBuffer.push(value);
      } else if (key === 'languagesLine') {
        result.languagesLine = value;
      } else {
        result[key] = value;
        capturingAddress = false;
      }
      break;
    }

    if (matchedLabel) continue;

    // Continuation of multi-line address (common after Permanent Address:)
    if (capturingAddress) {
      if (/^(declaration|languages?|education|experience|skills?|projects?)\b/i.test(line)) {
        capturingAddress = false;
      } else if (!/^(father|date of birth|marital|gender|nationality)\b/i.test(line)) {
        addressBuffer.push(line);
        result.address = addressBuffer.join(', ');
        continue;
      } else {
        capturingAddress = false;
      }
    }

    // Inline PII glued onto skills / other lines — strip chunks, keep remainder
    if (INLINE_PII_CHUNK.test(line)) {
      INLINE_PII_CHUNK.lastIndex = 0;
      let rest = line;
      for (const chunk of line.match(INLINE_PII_CHUNK) || []) {
        const father = chunk.match(/father\s*['’]?\s*s?\s*name\s*[:|\-–]\s*(.+)/i);
        const dob = chunk.match(/(?:date\s*of\s*birth|d\.?o\.?b\.?)\s*[:|\-–]\s*(.+)/i);
        const addr = chunk.match(/(?:permanent\s*address|address)\s*[:|\-–]\s*(.+)/i);
        // Bare "Name : X" is strip-only — do not store into fullName (dedicated name detection owns that).
        if (father?.[1] && !result.fathersName) result.fathersName = father[1].trim();
        if (dob?.[1] && !result.dateOfBirth) result.dateOfBirth = dob[1].trim();
        if (addr?.[1] && !result.address) result.address = addr[1].trim();
        rest = rest.replace(chunk, ' ').replace(/\s+/g, ' ').trim();
      }
      rest = rest.replace(/^[,;|.\-–—\s]+|[,;|.\-–—\s]+$/g, '').trim();
      if (rest.length > 2) result.strippedLines.push(rest);
      continue;
    }

    result.strippedLines.push(line);
  }

  if (result.address) {
    const cityLike = result.address.match(/\b([A-Za-z][A-Za-z\s]{2,20})\s*[-–]?\s*\d{2,6}\b/);
    if (cityLike && !/cross|main|nagar|layout|sector/i.test(cityLike[1])) {
      result.cityHint = cityLike[1].trim();
    }
  }

  return result;
}

/** True if a skill/token looks like leaked PII. */
export function looksLikePersonalLeakToken(token: string): boolean {
  return /^(father|mother|dob|date of birth|marital|gender|nationality|permanent|address|#\d|\d+(st|nd|rd|th)\s+cross)/i.test(
    token.trim(),
  ) || /father\s*['’]?\s*s?\s*name|date\s*of\s*birth|^name\s*[:|\-–]/i.test(token);
}
