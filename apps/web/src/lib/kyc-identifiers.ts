import { normalizeBusinessIdentifier } from '@careerbridge/shared';

/**
 * CIN part of the KYC payload. The form only knows the masked saved CIN, so a blank field omits `cin`
 * (the server keeps the saved one); removal is sent as '' only when the user explicitly asks for it.
 */
export function kycCinPayload(input: string, removeSaved: boolean): { cin?: string } {
  const cin = normalizeBusinessIdentifier(input);
  if (cin) return { cin };
  return removeSaved ? { cin: '' } : {};
}
