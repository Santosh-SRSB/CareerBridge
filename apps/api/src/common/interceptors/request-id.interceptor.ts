import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable, map } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in data) {
          return { ...data, requestId: data.requestId || requestId };
        }
        return { success: true, data, requestId };
      }),
    );
  }
}
