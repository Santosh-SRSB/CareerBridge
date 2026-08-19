export type ApiSuccess<T> = {
  success: true;
  data: T;
  requestId: string;
};

export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_EXISTS: 'ACCOUNT_EXISTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
