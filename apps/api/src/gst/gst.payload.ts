function firstString(data: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}

export function unwrapGstPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if (payload.Data && typeof payload.Data === 'object' && !Array.isArray(payload.Data)) {
    return payload.Data as Record<string, unknown>;
  }
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data as Record<string, unknown>;
  }
  return payload;
}

/** Trade / brand name only — never the legal company name. */
export function pickTradeName(data: Record<string, unknown>): string | null {
  return firstString(data, ['trade_name', 'tradeName', 'tradeNam', 'TradeName', 'TradeNam', 'trademark']);
}
