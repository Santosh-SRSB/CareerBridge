import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '@careerbridge/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request as Request & { requestId?: string }).requestId ||
      'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'Something went wrong. Please try again.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (typeof payload === 'object' && payload) {
        const body = payload as { message?: string | string[]; code?: string };
        const raw = Array.isArray(body.message) ? body.message[0] : body.message;
        if (raw) {
          message = raw;
        }
        if (body.code) {
          code = body.code;
        }
      }
      if (!code || code === ErrorCode.INTERNAL_ERROR) {
        if (status === HttpStatus.UNAUTHORIZED) code = ErrorCode.UNAUTHORIZED;
        else if (status === HttpStatus.FORBIDDEN) code = ErrorCode.FORBIDDEN;
        else if (status === HttpStatus.NOT_FOUND) code = ErrorCode.RESOURCE_NOT_FOUND;
        else if (status === HttpStatus.BAD_REQUEST) code = ErrorCode.VALIDATION_ERROR;
        else if (status === HttpStatus.CONFLICT) code = ErrorCode.DUPLICATE_RESOURCE;
        else if (status === HttpStatus.UNPROCESSABLE_ENTITY)
          code = ErrorCode.BUSINESS_RULE_VIOLATION;
        else if (status === HttpStatus.PAYMENT_REQUIRED) code = ErrorCode.PAYMENT_REQUIRED;
      }
    }

    response.status(status).json({
      success: false,
      error: { code, message },
      requestId,
    });
  }
}
