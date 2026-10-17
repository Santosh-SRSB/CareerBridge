/** Default retention windows (days). Overridable via platform settings. */
export const RETENTION_DEFAULTS = {
  resumeDays: 365,
  whatsappDays: 90,
  aiInteractionDays: 90,
  auditLogDays: 365,
} as const;

export const RETENTION_SETTING_KEYS = {
  resumeDays: 'system.resumeRetentionDays',
  whatsappDays: 'system.whatsappRetentionDays',
  aiInteractionDays: 'system.aiInteractionRetentionDays',
  auditLogDays: 'system.auditRetentionDays',
} as const;

/** Rows processed per deleteMany call to keep Cloud Run requests bounded. */
export const RETENTION_BATCH_SIZE = 500;
