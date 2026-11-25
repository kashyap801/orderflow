import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger, type CorrelationRequest } from '@orderflow/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface GatewayRoute {
  prefix: string;
  service: string;
  targetEnvKey: string;
  upstreamPrefix: string;
}

export const GATEWAY_ROUTES: readonly GatewayRoute[] = [
  {
    prefix: '/api/v1/orders',
    service: 'order-service',
    targetEnvKey: 'ORDER_SERVICE_URL',
    upstreamPrefix: '/api/v1/orders',
  },
  {
    prefix: '/api/v1/inventory',
    service: 'inventory-service',
    targetEnvKey: 'INVENTORY_SERVICE_URL',
    upstreamPrefix: '/api/v1',
  },
  {
    prefix: '/api/v1/payments',
    service: 'payment-service',
    targetEnvKey: 'PAYMENT_SERVICE_URL',
    upstreamPrefix: '/api/v1/payments',
  },
  {
    prefix: '/api/v1/notifications',
    service: 'notification-service',
    targetEnvKey: 'NOTIFICATION_SERVICE_URL',
    upstreamPrefix: '/api/v1/notifications',
  },
];

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger: AppLogger;

  constructor(
    private readonly config: ConfigService,
    logger: AppLogger,
  ) {
    this.logger = logger.withContext('Gateway');
  }

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    const route = this.resolveRoute(request.originalUrl);
    if (route === undefined) {
      next();
      return;
    }

    const supplied = request.header('x-correlation-id')?.trim();
    const correlationId =
      (request as CorrelationRequest).correlationId ??
      (supplied !== undefined && supplied.length > 0 && supplied.length <= 64
        ? supplied
        : randomUUID());
    (request as CorrelationRequest).correlationId = correlationId;
    const target = this.buildTarget(request.originalUrl, route);

    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers: this.forwardHeaders(request, correlationId),
        ...(isBodyMethod(request.method) ? { body: JSON.stringify(request.body ?? {}) } : {}),
      });

      const body = await upstream.text();
      response.status(upstream.status);
      response.setHeader('X-Correlation-Id', correlationId);

      if (isJson(upstream.headers.get('content-type')) && body.length > 0) {
        const payload: unknown = JSON.parse(body);
        response.json(rewriteCorrelation(payload, correlationId));
      } else {
        response.send(body);
      }
    } catch (error) {
      this.logger.warn(`Upstream ${route.service} unavailable: ${String(error)}`);
      response.status(502).json({
        statusCode: 502,
        code: 'BAD_GATEWAY',
        message: `Upstream service unavailable: ${route.service}`,
        correlationId,
      });
    }
  }

  private resolveRoute(url: string): GatewayRoute | undefined {
    const path = url.split('?')[0] ?? url;
    return GATEWAY_ROUTES.find(
      (route) => path === route.prefix || path.startsWith(`${route.prefix}/`),
    );
  }

  private buildTarget(url: string, route: GatewayRoute): string {
    const [path = '', query] = url.split('?');
    const suffix = path.slice(route.prefix.length);
    const base = this.config
      .get<string>(route.targetEnvKey, `http://localhost:${defaultPort(route.targetEnvKey)}`)
      .replace(/\/$/, '');
    const upstreamPath = `${route.upstreamPrefix}${suffix}`;
    return query === undefined || query.length === 0
      ? `${base}${upstreamPath}`
      : `${base}${upstreamPath}?${query}`;
  }

  private forwardHeaders(request: Request, correlationId: string): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-correlation-id': correlationId,
    };
    const authorization = request.header('authorization');
    const userId = request.header('x-user-id');
    if (authorization !== undefined) headers.authorization = authorization;
    if (userId !== undefined) headers['x-user-id'] = userId;
    return headers;
  }
}

function isBodyMethod(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

function isJson(contentType: string | null): boolean {
  return contentType !== null && contentType.includes('json');
}

function rewriteCorrelation(payload: unknown, correlationId: string): unknown {
  if (typeof payload !== 'object' || payload === null) return payload;
  if (!('correlationId' in payload)) return payload;
  return { ...payload, correlationId };
}

function defaultPort(envKey: string): number {
  const ports: Record<string, number> = {
    ORDER_SERVICE_URL: 3001,
    INVENTORY_SERVICE_URL: 3002,
    PAYMENT_SERVICE_URL: 3003,
    NOTIFICATION_SERVICE_URL: 3004,
  };
  return ports[envKey] ?? 3001;
}
