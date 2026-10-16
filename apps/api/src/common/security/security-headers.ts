import type { Request, Response, NextFunction } from 'express';

/**
 * SEC-CLOUD-009 — baseline API security headers (no helmet dependency).
 *
 * CORP/COOP are omitted: web and API use separate Cloud Run hosts, so
 * Cross-Origin-Resource-Policy: same-site can block legitimate SPA→API fetches.
 *
 * CSP is intentionally minimal on API JSON responses. When Swagger UI is enabled
 * locally we only set frame-ancestors so Swagger's own scripts still load.
 */
export type SecurityHeaderOptions = {
  /** Emit HSTS (Cloud Run / production-like HTTPS termination). */
  enableHsts: boolean;
  /** When true, Swagger UI is mounted — use a looser CSP. */
  swaggerEnabled: boolean;
};

export function buildSecurityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  if (options.swaggerEnabled) {
    headers['Content-Security-Policy'] = "frame-ancestors 'none'";
  } else {
    headers['Content-Security-Policy'] =
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
  }

  if (options.enableHsts) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  return headers;
}

export function securityHeadersMiddleware(options: SecurityHeaderOptions) {
  const headers = buildSecurityHeaders(options);
  return (_req: Request, res: Response, next: NextFunction) => {
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    next();
  };
}
