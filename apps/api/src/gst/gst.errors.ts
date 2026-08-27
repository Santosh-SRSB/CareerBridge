import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@careerbridge/shared';

export class GstConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GstConfigError';
  }
}

export class GstProviderError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'GstProviderError';
  }
}

export function gstValidationException(message: string) {
  return new HttpException(
    { code: ErrorCode.VALIDATION_ERROR, message },
    HttpStatus.BAD_REQUEST,
  );
}

export function gstUnavailableException(
  message = 'GSTIN verification is temporarily unavailable. Please try again.',
) {
  return new HttpException(
    {
      code: ErrorCode.INTERNAL_ERROR,
      message,
      verified: false,
      status: 'UNKNOWN',
    },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
