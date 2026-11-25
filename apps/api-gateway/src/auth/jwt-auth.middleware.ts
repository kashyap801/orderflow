import { Injectable, type NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

const PUBLIC_PATHS = [
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/health',
  '/api/v1/health/ready',
  '/api/v1/docs',
  '/api/v1/docs-json',
  '/api/v1/gateway/routes',
  '/api/v1/gateway/auth-context',
];

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const path = request.originalUrl.split('?')[0] ?? '';

    if (request.method === 'OPTIONS' || isPublicPath(path)) {
      next();
      return;
    }

    const authorization = request.header('authorization');
    const token =
      authorization !== undefined && /^Bearer\s+\S+$/i.test(authorization.trim())
        ? authorization.trim().replace(/^Bearer\s+/i, '')
        : undefined;

    if (token === undefined) {
      response.status(401).json({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Bearer token required',
      });
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token);
    } catch {
      response.status(401).json({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
      return;
    }

    if (isAdminOnly(request.method, path) && payload.role !== 'ADMIN') {
      response.status(403).json({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Admin role required',
      });
      return;
    }

    request.headers['x-user-id'] = payload.sub;
    request.headers['x-user-role'] = payload.role;
    next();
  }
}

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) => path === publicPath || path.startsWith(`${publicPath}/`),
  );
}

function isAdminOnly(method: string, path: string): boolean {
  const products = '/api/v1/inventory/products';
  if (method === 'POST' && path === products) return true;
  if (
    (method === 'PATCH' || method === 'DELETE') &&
    /^\/api\/v1\/inventory\/products\/[^/]+$/.test(path)
  ) {
    return true;
  }
  return method === 'POST' && /^\/api\/v1\/inventory\/products\/[^/]+\/restock$/.test(path);
}
