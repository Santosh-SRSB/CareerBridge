/** Official GSTIN pattern: 2 digit state + PAN + entity + Z + checksum */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

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
  return null;
}

export function maskGstin(gstin: string): string {
  const value = normalizeGstin(gstin);
  if (value.length < 10) return '***';
  return `${value.slice(0, 7)}******${value.slice(-2)}`;
}
