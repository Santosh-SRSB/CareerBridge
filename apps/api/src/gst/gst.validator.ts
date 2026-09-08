/** Official GSTIN pattern: 2 digit state + PAN + entity + Z + checksum */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CODEPOINTS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** GSTIN check digit over the first 14 characters (Luhn mod 36). */
export function gstinChecksumValid(gstin: string): boolean {
  if (gstin.length !== 15) return false;
  let factor = 2;
  let total = 0;
  for (let i = 13; i >= 0; i -= 1) {
    const codePoint = GSTIN_CODEPOINTS.indexOf(gstin[i]);
    if (codePoint < 0) return false;
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    total += addend;
  }
  const check = (36 - (total % 36)) % 36;
  return GSTIN_CODEPOINTS[check] === gstin[14];
}

export function normalizeGstin(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function validateGstinFormat(gstin: string): string | null {
  if (!gstin) {
    return 'Enter a GSTIN.';
  }
  if (gstin.length !== 15) {
    return 'GSTIN must be exactly 15 characters.';
  }
  if (!GSTIN_REGEX.test(gstin)) {
    return 'Enter a valid 15-character GSTIN.';
  }
  if (!gstinChecksumValid(gstin)) {
    return 'This GSTIN is not valid. Check the number and try again.';
  }
  return null;
}

export function maskGstin(gstin: string): string {
  const value = normalizeGstin(gstin);
  if (value.length < 10) return '***';
  return `${value.slice(0, 7)}******${value.slice(-2)}`;
}
