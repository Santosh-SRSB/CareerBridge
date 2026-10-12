import { gstinFormatError, normalizeBusinessIdentifier } from '@careerbridge/shared';

export { gstinChecksumValid } from '@careerbridge/shared';

export function normalizeGstin(raw: string): string {
  return normalizeBusinessIdentifier(raw);
}

export function validateGstinFormat(gstin: string): string | null {
  return gstinFormatError(gstin);
}

/** Log-only mask; API responses use maskGstinForDisplay from @careerbridge/shared. */
export function maskGstin(gstin: string): string {
  const value = normalizeGstin(gstin);
  if (value.length < 10) return '***';
  return `${value.slice(0, 7)}******${value.slice(-2)}`;
}
