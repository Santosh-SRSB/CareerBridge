/**
 * Indian business identifiers (GSTIN, PAN, CIN): normalisation, format checks and display masks.
 * Format checks only; they do not mean the identifier was verified with the issuing authority.
 */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CODEPOINTS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** Structure only, as in the legacy panNumberError: the holder-type letter in position 4 is not restricted. */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
/** Listing status + 5-digit industry code + state + year + ownership + 6-digit registration number. */
const CIN_REGEX = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

/** Trim, drop all whitespace and upper-case. Applied before validation, storage and lookup. */
export function normalizeBusinessIdentifier(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

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

/** Expects a normalised value. */
export function gstinFormatError(gstin: string): string | null {
  if (!gstin) return 'Enter a GSTIN.';
  if (gstin.length !== 15) return 'GSTIN must be exactly 15 characters.';
  if (!GSTIN_REGEX.test(gstin)) return 'Enter a valid 15-character GSTIN.';
  if (!gstinChecksumValid(gstin)) return 'This GSTIN is not valid. Check the number and try again.';
  return null;
}

/** Expects a normalised value. */
export function panFormatError(pan: string): string | null {
  if (!pan) return 'Enter the PAN.';
  if (pan.length !== 10) return 'PAN must be exactly 10 characters.';
  if (!PAN_REGEX.test(pan)) return 'Enter a valid PAN, for example ABCPE1234F.';
  return null;
}

/** Expects a normalised value. CIN is optional, so an empty value is valid. */
export function cinFormatError(cin: string): string | null {
  if (!cin) return null;
  if (cin.length !== 21) return 'CIN must be exactly 21 characters.';
  if (!CIN_REGEX.test(cin)) return 'Enter a valid 21-character CIN, for example U72900MH2015PTC123456.';
  return null;
}

function maskMiddle(value: string, keepStart: number, keepEnd: number): string {
  if (value.length <= keepStart + keepEnd) return '*'.repeat(value.length);
  return `${value.slice(0, keepStart)}${'*'.repeat(value.length - keepStart - keepEnd)}${value.slice(-keepEnd)}`;
}

/** 29ABCPE1234F1Z5 -> 29ABCPE*****1Z5 (state code and PAN letters, then the last three characters). */
export function maskGstinForDisplay(gstin: string): string {
  return maskMiddle(normalizeBusinessIdentifier(gstin), 7, 3);
}

/** ABCPE1234F -> ABCPE****F */
export function maskPanForDisplay(pan: string): string {
  return maskMiddle(normalizeBusinessIdentifier(pan), 5, 1);
}

/** U72900MH2015PTC123456 -> U72900************456 */
export function maskCinForDisplay(cin: string): string {
  return maskMiddle(normalizeBusinessIdentifier(cin), 6, 3);
}
