import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppLogger } from '../logging/app-logger';
import { CorrelationContext } from './correlation-context';

export interface CorrelationRequest extends Request {
  correlationId?: string;
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  private readonly logger: AppLogger;

  constructor(logger: AppLogger) {
    this.logger = logger.withContext('HTTP');
  }

  use(request: Request, response: Response, next: NextFunction): void {
    const supplied = request.header('x-correlation-id')?.trim();
    const correlationId =
      supplied !== undefined && supplied.length > 0 && supplied.length <= 64
        ? supplied
        : randomUUID();

    (request as CorrelationRequest).correlationId = correlationId;
    response.setHeader('X-Correlation-Id', correlationId);

    const startedAt = Date.now();
    CorrelationContext.run(correlationId, () => {
      response.once('finish', () => {
        const durationMs = Date.now() - startedAt;
        this.logger.log(
          `${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`,
        );
      });
      next();
    });
  }
}
