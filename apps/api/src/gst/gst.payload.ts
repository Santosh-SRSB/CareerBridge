function firstString(data: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function unwrapGstPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const nested =
    asRecord(payload.Data) ||
    asRecord(payload.data) ||
    asRecord(payload.result) ||
    asRecord(payload.taxpayerInfo) ||
    asRecord(payload.taxpayer);
  if (!nested) return payload;
  // Keep outer fields (status, success) while preferring nested taxpayer details.
  return { ...payload, ...nested };
}

/** Trade / brand name only — never the legal company name. */
export function pickTradeName(data: Record<string, unknown>): string | null {
  return firstString(data, [
    'trade_name',
    'tradeName',
    'tradeNam',
    'TradeName',
    'TradeNam',
    'trademark',
    'tradename',
    'TRADE_NAME',
  ]);
}

/** Registered display name for KYC auto-fill: trade name, then legal name. */
export function pickRegisteredName(data: Record<string, unknown>): string | null {
  return (
    pickTradeName(data) ||
    firstString(data, ['lgnm', 'legal_name', 'legalName', 'LegalName', 'lglNm', 'Lgnm'])
  );
}
