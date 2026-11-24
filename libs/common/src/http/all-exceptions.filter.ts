import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorResponse } from './api-response';
import { CorrelationContext } from './correlation-context';
import type { CorrelationRequest } from './correlation.middleware';
import { AppLogger } from '../logging/app-logger';

export interface ExceptionFilterOptions {
  logger: AppLogger;
  isProduction: boolean;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger: AppLogger;
  private readonly isProduction: boolean;

  constructor(options: ExceptionFilterOptions) {
    this.logger = options.logger.withContext('Errors');
    this.isProduction = options.isProduction;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<CorrelationRequest | undefined>();
    const response = http.getResponse<Response>();
    const correlationId = request?.correlationId ?? CorrelationContext.getId() ?? 'unknown';

    const status = resolveStatus(exception);
    const code = resolveCode(exception, status);
    const message = resolveMessage(exception, status, this.isProduction);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(message, exception instanceof Error ? exception : undefined);
    } else {
      this.logger.warn(message);
    }

    const body: ApiErrorResponse = {
      statusCode: status,
      code,
      message,
      correlationId,
    };
    response.status(status).json(body);
  }
}

function resolveStatus(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function resolveCode(exception: unknown, status: number): string {
  if (exception instanceof HttpException) {
    const payload = exception.getResponse();
    if (typeof payload === 'object' && payload !== null && 'code' in payload) {
      const value = (payload as { code?: unknown }).code;
      if (typeof value === 'string' && value.length > 0) return value;
    }
  }

  const codes: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.CONFLICT]: 'CONFLICT',
    [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  };
  return codes[status] ?? 'INTERNAL_SERVER_ERROR';
}

function resolveMessage(
  exception: unknown,
  status: number,
  isProduction: boolean,
): string | string[] {
  if (exception instanceof HttpException) {
    const payload = exception.getResponse();
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const value = (payload as { message?: unknown }).message;
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
    }
    return safeDefaultMessage(status);
  }

  if (isProduction || !(exception instanceof Error)) return safeDefaultMessage(status);
  return exception.message || safeDefaultMessage(status);
}

function safeDefaultMessage(status: number): string {
  if (status === HttpStatus.SERVICE_UNAVAILABLE) return 'Service unavailable';
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) return 'Internal server error';
  return HttpStatus[status] ?? 'Request failed';
}
