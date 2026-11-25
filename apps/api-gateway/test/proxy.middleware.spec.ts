import { ConfigService } from '@nestjs/config';
import { AppLogger } from '@orderflow/common';
import type { NextFunction, Request, Response } from 'express';
import { ProxyMiddleware } from '../src/proxy/proxy.middleware';

function config(values: Record<string, string>): ConfigService {
  return {
    get(key: string, fallback: string) {
      return values[key] ?? fallback;
    },
  } as ConfigService;
}

function responseMock() {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

function requestMock(url: string, method = 'GET', headers: Record<string, string> = {}) {
  return {
    originalUrl: url,
    method,
    correlationId: headers['x-correlation-id'] ?? 'gateway-id',
    body: {},
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe('ProxyMiddleware unit rules', () => {
  const urls = {
    ORDER_SERVICE_URL: 'http://order',
    INVENTORY_SERVICE_URL: 'http://inventory',
    PAYMENT_SERVICE_URL: 'http://payment',
    NOTIFICATION_SERVICE_URL: 'http://notification',
  };
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('passes non-domain routes through', async () => {
    const middleware = new ProxyMiddleware(config(urls), new AppLogger('Test'));
    const next = jest.fn() as unknown as NextFunction;
    await middleware.use(requestMock('/api/v1/health'), responseMock(), next);
    expect(next).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards inventory requests to the upstream API path with query string', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify({ data: { ok: true }, correlationId: 'upstream' }),
    });
    const middleware = new ProxyMiddleware(config(urls), new AppLogger('Test'));
    const response = responseMock();

    await middleware.use(
      requestMock('/api/v1/inventory/products?active=true', 'GET', {
        'x-correlation-id': 'gateway-id',
        authorization: 'Bearer token',
      }),
      response,
      jest.fn() as unknown as NextFunction,
    );

    const [target, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe('http://inventory/api/v1/products?active=true');
    expect((options.headers as Record<string, string>)['x-correlation-id']).toBe('gateway-id');
    expect((options.headers as Record<string, string>).authorization).toBe('Bearer token');
    expect(response.json).toHaveBeenCalledWith({ data: { ok: true }, correlationId: 'gateway-id' });
  });

  it('normalizes unreachable upstream services as 502', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const middleware = new ProxyMiddleware(config(urls), new AppLogger('Test'));
    const response = responseMock();

    await middleware.use(
      requestMock('/api/v1/orders', 'GET', { 'x-correlation-id': 'gateway-id' }),
      response,
      jest.fn() as unknown as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(502);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'BAD_GATEWAY', correlationId: 'gateway-id' }),
    );
  });
});
