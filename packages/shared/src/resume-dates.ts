/**
 * Precision-preserving resume date parse/format.
 * Never invents day/month that were not present in the source.
 */

const MONTHS: Array<{ re: RegExp; num: number; abbr: string }> = [
  { re: /^jan(?:uary)?$/i, num: 1, abbr: 'JAN' },
  { re: /^feb(?:ruary)?$/i, num: 2, abbr: 'FEB' },
  { re: /^mar(?:ch)?$/i, num: 3, abbr: 'MAR' },
  { re: /^apr(?:il)?$/i, num: 4, abbr: 'APR' },
  { re: /^may$/i, num: 5, abbr: 'MAY' },
  { re: /^jun(?:e)?$/i, num: 6, abbr: 'JUN' },
  { re: /^jul(?:y)?$/i, num: 7, abbr: 'JUL' },
  { re: /^aug(?:ust)?$/i, num: 8, abbr: 'AUG' },
  { re: /^sep(?:t(?:ember)?)?$/i, num: 9, abbr: 'SEP' },
  { re: /^oct(?:ober)?$/i, num: 10, abbr: 'OCT' },
  { re: /^nov(?:ember)?$/i, num: 11, abbr: 'NOV' },
  { re: /^dec(?:ember)?$/i, num: 12, abbr: 'DEC' },
];

export type ResumeDatePrecision = 'day' | 'month' | 'year' | 'unknown';

export type ParsedResumeDate = {
  /** Machine value: YYYY-MM-DD | YYYY-MM | YYYY */
  iso: string;
  precision: ResumeDatePrecision;
  day?: number;
  month?: number;
  year: number;
};

function monthFromToken(token: string): { num: number; abbr: string } | null {
  const t = token.trim();
  for (const m of MONTHS) {
    if (m.re.test(t)) return { num: m.num, abbr: m.abbr };
  }
  const asNum = Number.parseInt(t, 10);
  if (asNum >= 1 && asNum <= 12) {
    return { num: asNum, abbr: MONTHS[asNum - 1].abbr };
  }
  return null;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Parse a single date token without inventing missing precision. */
export function parseResumeDate(raw: string | null | undefined): ParsedResumeDate | null {
  if (!raw?.trim()) return null;
  const text = raw.trim().replace(/\u00a0/g, ' ');

  if (/^(present|current|till\s*date|to\s*date|ongoing|now)$/i.test(text)) {
    return null;
  }

  // YYYY-MM-DD
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { iso: `${year}-${pad2(month)}-${pad2(day)}`, precision: 'day', day, month, year };
    }
  }

  // YYYY-MM
  m = text.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) {
      return { iso: `${year}-${pad2(month)}`, precision: 'month', month, year };
    }
  }

  // Year only
  m = text.match(/^(19|20)\d{2}$/);
  if (m) {
    const year = Number(text);
    return { iso: String(year), precision: 'year', year };
  }

  // 23/09/2026 or 23-09-2026
  m = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.]((?:19|20)\d{2})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { iso: `${year}-${pad2(month)}-${pad2(day)}`, precision: 'day', day, month, year };
    }
  }

  // 2026/09/23
  m = text.match(/^((?:19|20)\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { iso: `${year}-${pad2(month)}-${pad2(day)}`, precision: 'day', day, month, year };
    }
  }

  // 23 September 2026 | 23 Sep 2026 | 23rd Sep 2024
  m = text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s*,?\s*((?:19|20)\d{2})$/);
  if (m) {
    const day = Number(m[1]);
    const mon = monthFromToken(m[2]);
    const year = Number(m[3]);
    if (mon && day >= 1 && day <= 31) {
      return { iso: `${year}-${pad2(mon.num)}-${pad2(day)}`, precision: 'day', day, month: mon.num, year };
    }
  }

  // September 23, 2026 | Sep 23, 2026
  m = text.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*((?:19|20)\d{2})$/);
  if (m) {
    const mon = monthFromToken(m[1]);
    const day = Number(m[2]);
    const year = Number(m[3]);
    if (mon && day >= 1 && day <= 31) {
      return { iso: `${year}-${pad2(mon.num)}-${pad2(day)}`, precision: 'day', day, month: mon.num, year };
    }
  }

  // January 2024 | Jan 2024 | JAN 2024
  m = text.match(/^([A-Za-z]+)\s+((?:19|20)\d{2})$/);
  if (m) {
    const mon = monthFromToken(m[1]);
    const year = Number(m[2]);
    if (mon) {
      return { iso: `${year}-${pad2(mon.num)}`, precision: 'month', month: mon.num, year };
    }
  }

  // 2020 October (year then month — common in some Indian resumes)
  m = text.match(/^((?:19|20)\d{2})\s+([A-Za-z]+)$/);
  if (m) {
    const year = Number(m[1]);
    const mon = monthFromToken(m[2]);
    if (mon) {
      return { iso: `${year}-${pad2(mon.num)}`, precision: 'month', month: mon.num, year };
    }
  }

  // 01/2022 or 1-2022
  m = text.match(/^(\d{1,2})[\/\-]((?:19|20)\d{2})$/);
  if (m) {
    const month = Number(m[1]);
    const year = Number(m[2]);
    if (month >= 1 && month <= 12) {
      return { iso: `${year}-${pad2(month)}`, precision: 'month', month, year };
    }
  }

  return null;
}

/** Display format preserving source precision: 23 SEP 2026 | SEP 2024 | 2024 */
export function formatResumeDate(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  if (/^(present|current|till\s*date|to\s*date|ongoing|now)$/i.test(raw.trim())) {
    return 'PRESENT';
  }
  const parsed = parseResumeDate(raw);
  if (!parsed) return raw.trim();
  if (parsed.precision === 'day' && parsed.day && parsed.month) {
    return `${parsed.day} ${MONTHS[parsed.month - 1].abbr} ${parsed.year}`;
  }
  if (parsed.precision === 'month' && parsed.month) {
    return `${MONTHS[parsed.month - 1].abbr} ${parsed.year}`;
  }
  if (parsed.precision === 'year') {
    return String(parsed.year);
  }
  return raw.trim();
}

/** Range display: 23 SEP 2024 – PRESENT */
export function formatResumeDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  isCurrent = false,
): string {
  const start = formatResumeDate(startDate);
  if (isCurrent || /^(present|current|ongoing)$/i.test(String(endDate || '').trim())) {
    return start ? `${start} – PRESENT` : 'PRESENT';
  }
  const end = formatResumeDate(endDate);
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

/** Normalize a free-text date for storage (machine iso when parseable). */
export function normalizeResumeDateForStorage(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  if (/^(present|current|till\s*date|to\s*date|ongoing|now)$/i.test(raw.trim())) {
    return null;
  }
  const parsed = parseResumeDate(raw);
  return parsed ? parsed.iso : raw.trim();
}

/** Convert stored date to YYYY-MM for <input type="month"> when month+year known. */
export function toMonthInputValue(raw: string | null | undefined): string {
  const parsed = parseResumeDate(raw);
  if (!parsed) return '';
  if (parsed.precision === 'year') return '';
  if (parsed.month) return `${parsed.year}-${pad2(parsed.month)}`;
  return '';
}
