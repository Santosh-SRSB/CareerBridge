export type GstInternalStatus = 'ACTIVE' | 'NOT_ACTIVE' | 'UNKNOWN';

/**
 * Normalize taxpayer status from IRIS IRP / NIC-compatible Get GSTIN Details payloads.
 * Maps only well-known active/non-active values — does not invent unsupported statuses.
 */
export function normalizeGstStatus(raw: unknown): GstInternalStatus {
  if (raw === null || raw === undefined) {
    return 'UNKNOWN';
  }
  const value = String(raw).trim().toUpperCase();
  if (!value) {
    return 'UNKNOWN';
  }

  // Exact / short codes commonly returned by NIC-compatible IRPs
  if (value === 'ACTIVE' || value === 'ACT' || value === 'A') {
    return 'ACTIVE';
  }

  if (
    value === 'INACTIVE' ||
    value === 'INACT' ||
    value === 'I' ||
    value === 'CANCELLED' ||
    value === 'CANCELED' ||
    value === 'CNL' ||
    value === 'SUSPENDED' ||
    value === 'SUSP' ||
    value === 'CANCEL' ||
    value.includes('INACTIVE') ||
    value.includes('CANCEL') ||
    value.includes('SUSPEND')
  ) {
    return 'NOT_ACTIVE';
  }

  if (value.includes('ACTIVE')) {
    return 'ACTIVE';
  }

  return 'UNKNOWN';
}

export function verifiedFromStatus(status: GstInternalStatus): boolean {
  return status === 'ACTIVE';
}
