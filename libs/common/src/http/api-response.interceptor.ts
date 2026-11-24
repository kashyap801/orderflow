import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { type Observable, map } from 'rxjs';
import type { ApiSuccessResponse } from './api-response';
import { CorrelationContext } from './correlation-context';
import type { CorrelationRequest } from './correlation.middleware';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        const request = context.switchToHttp().getRequest<CorrelationRequest | undefined>();
        const correlationId = request?.correlationId ?? CorrelationContext.getId() ?? 'unknown';

        if (isWrapped(data)) return data;

        const response: ApiSuccessResponse<unknown> = {
          data: data ?? null,
          correlationId,
        };
        return response;
      }),
    );
  }
}

function isWrapped(value: unknown): value is ApiSuccessResponse<unknown> {
  return (
    typeof value === 'object' && value !== null && 'data' in value && 'correlationId' in value
  );
}
