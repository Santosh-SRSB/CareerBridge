export type SecurityHeader = { key: string; value: string };

/** Baseline browser hardening. HSTS is only emitted for production responses. */
export function apiSecurityHeaders(nodeEnv: string | undefined): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ];
  if (nodeEnv === 'production') {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
  }
  return headers;
}

export function exposeApiDocs(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}
