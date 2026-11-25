import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { JwtAuthMiddleware } from '../src/auth/jwt-auth.middleware';

const jwt = new JwtService({ secret: 'test-secret' });

function token(role = 'USER'): string {
  return jwt.sign({ sub: 'user-1', email: 'user@example.com', role });
}

function requestMock(
  url: string,
  method = 'GET',
  authorization?: string,
): { request: Request; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  const request = {
    originalUrl: url,
    method,
    headers,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
  return { request, headers };
}

function responseMock() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('JwtAuthMiddleware', () => {
  const middleware = new JwtAuthMiddleware(jwt);

  it('lets public paths through without a token', () => {
    const { request } = requestMock('/api/v1/auth/login', 'POST');
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(request, responseMock(), next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects a missing token on a protected path', () => {
    const response = responseMock();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(requestMock('/api/v1/orders').request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it('rejects an invalid token', () => {
    const response = responseMock();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(
      requestMock('/api/v1/orders', 'GET', 'Bearer not-a-jwt').request,
      response,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it('sets user headers for a valid token', () => {
    const { request, headers } = requestMock('/api/v1/orders', 'GET', `Bearer ${token()}`);
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(request, responseMock(), next);

    expect(next).toHaveBeenCalled();
    expect(headers['x-user-id']).toBe('user-1');
    expect(headers['x-user-role']).toBe('USER');
  });

  it('allows a USER to read products but blocks product creation', () => {
    const read = requestMock('/api/v1/inventory/products', 'GET', `Bearer ${token()}`);
    const create = requestMock('/api/v1/inventory/products', 'POST', `Bearer ${token()}`);
    const createResponse = responseMock();
    const readNext = jest.fn() as unknown as NextFunction;

    middleware.use(read.request, responseMock(), readNext);
    middleware.use(create.request, createResponse, jest.fn() as unknown as NextFunction);

    expect(readNext).toHaveBeenCalled();
    expect(createResponse.status).toHaveBeenCalledWith(403);
  });

  it('allows an ADMIN to create a product', () => {
    const { request } = requestMock(
      '/api/v1/inventory/products',
      'POST',
      `Bearer ${token('ADMIN')}`,
    );
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(request, responseMock(), next);

    expect(next).toHaveBeenCalled();
  });
});
