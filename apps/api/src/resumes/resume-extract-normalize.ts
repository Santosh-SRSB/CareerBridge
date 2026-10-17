import {
  normalizeResumeDateForStorage,
  parseResumeDate,
  type ResumeContent,
} from '@careerbridge/shared';

/** Validate AI-extracted string against source text — reject invented values. */
export function groundedInSource(value: string | null | undefined, sourceText: string): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  if (!sourceText?.trim()) return true;
  if (v.length < 2) return true;
  const src = sourceText.toLowerCase();
  const needle = v.toLowerCase();
  if (src.includes(needle)) return true;
  // Allow slight whitespace / punctuation differences
  const compact = (s: string) => s.replace(/[^a-z0-9+#.]/gi, '').toLowerCase();
  return compact(src).includes(compact(v));
}

export function filterGroundedString(
  value: string | null | undefined,
  sourceText: string,
  fallback: string | null = null,
): string | null {
  const v = String(value || '').trim();
  if (!v) return fallback;
  return groundedInSource(v, sourceText) ? v : fallback;
}

export function filterGroundedList(values: string[], sourceText: string): string[] {
  return values.filter((v) => groundedInSource(v, sourceText));
}

export function normalizeExperienceDates(row: {
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
}): { startDate: string | null; endDate: string | null; isCurrent: boolean } {
  const isCurrent =
    Boolean(row.isCurrent) ||
    /present|current|till\s*date|to\s*date|ongoing/i.test(String(row.endDate || ''));
  const startDate = normalizeResumeDateForStorage(row.startDate);
  const endDate = isCurrent ? null : normalizeResumeDateForStorage(row.endDate);
  return { startDate, endDate, isCurrent };
}

/** Split "City, State, Country" without inventing missing parts. */
export function splitLocationParts(raw: string | null | undefined): {
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  postalCode: string | null;
} {
  if (!raw?.trim()) {
    return { city: null, state: null, country: null, address: null, postalCode: null };
  }
  const text = raw.trim();
  const postal = text.match(/\b(\d{5,6})\b/)?.[1] || null;

  // Long address-like strings: keep as address, try to peel state/country
  const looksLikeAddress =
    /\b(village|district|road|street|nagar|layout|sector|plot|near|pin)\b/i.test(text) ||
    text.split(',').length >= 4 ||
    (postal && text.length > 40);

  const parts = text.split(',').map((p) => p.replace(/\b\d{5,6}\b/g, '').trim()).filter(Boolean);
  const countries = new Set(['india', 'usa', 'united states', 'uk', 'united kingdom', 'uae', 'canada', 'australia']);

  let country: string | null = null;
  let state: string | null = null;
  let city: string | null = null;

  if (parts.length >= 3 && countries.has(parts[parts.length - 1].toLowerCase())) {
    country = parts[parts.length - 1];
    state = parts[parts.length - 2];
    city = parts[0];
  } else if (parts.length === 2) {
    if (countries.has(parts[1].toLowerCase())) {
      city = parts[0];
      country = parts[1];
    } else {
      city = parts[0];
      state = parts[1];
    }
  } else if (parts.length === 1) {
    city = parts[0];
  } else if (parts.length > 2) {
    city = parts[0];
    state = parts[parts.length - 1];
  }

  if (looksLikeAddress) {
    return {
      city: city && city.length < 40 ? city : null,
      state,
      country,
      address: text,
      postalCode: postal,
    };
  }

  return {
    city,
    state,
    country,
    address: null,
    postalCode: postal,
  };
}

export function attachPersonalBlock(content: ResumeContent): ResumeContent {
  const loc = splitLocationParts(content.city);
  const city = loc.address ? loc.city : loc.city || content.city;
  return {
    ...content,
    city: city || content.city,
    personal: {
      fullName: content.fullName,
      email: content.email ?? null,
      phone: content.phone ?? null,
      city: city || content.city,
      state: loc.state,
      country: loc.country,
      address: loc.address,
      postalCode: loc.postalCode,
      ...(content.links?.linkedin ? { linkedin: content.links.linkedin } : {}),
      ...(content.links?.github ? { github: content.links.github } : {}),
      ...(content.links?.portfolio || content.links?.website
        ? { portfolio: content.links.portfolio || content.links.website }
        : {}),
    },
  };
}

export function ensureExperienceDateShape(content: ResumeContent): ResumeContent {
  return {
    ...content,
    experiences: (content.experiences || []).map((row) => {
      const dates = normalizeExperienceDates(row);
      return {
        ...row,
        startDate: dates.startDate,
        endDate: dates.endDate,
        isCurrent: dates.isCurrent,
      };
    }),
  };
}

export function yearFromDateToken(raw: string | null | undefined): number | null {
  const parsed = parseResumeDate(raw);
  return parsed?.year ?? null;
}
