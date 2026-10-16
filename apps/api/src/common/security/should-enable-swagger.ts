/**
 * SEC-CLOUD-010 — Swagger/OpenAPI UI is for local development only.
 *
 * Enabled only when neither production-like signal is set:
 * - NODE_ENV is not "production", AND
 * - GCP_PROJECT_ID is unset/empty.
 *
 * ENABLE_SWAGGER is accepted in the env type for operators/docs but is ignored:
 * it cannot re-enable /api/docs when either production-like condition applies.
 */
export type SwaggerEnv = {
  NODE_ENV?: string;
  GCP_PROJECT_ID?: string;
  /** Documented for operators; ignored by shouldEnableSwagger (cannot force-enable on Cloud Run). */
  ENABLE_SWAGGER?: string;
};

export function shouldEnableSwagger(env: SwaggerEnv = process.env): boolean {
  const isProduction = String(env.NODE_ENV || '').trim() === 'production';
  const onGcp = Boolean(String(env.GCP_PROJECT_ID || '').trim());
  return !isProduction && !onGcp;
}
