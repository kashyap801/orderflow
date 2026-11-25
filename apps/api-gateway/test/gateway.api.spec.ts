import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter, ApiResponseInterceptor, AppLogger } from '@orderflow/common';
import { createServer, type Server } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AuthContextService } from '../src/auth/auth-context';
import { GatewayController } from '../src/gateway.controller';
import { ProxyMiddleware } from '../src/proxy/proxy.middleware';

describe('Gateway API', () => {
  let app: INestApplication;
  let upstream: Server;
  let seen: { url?: string; correlationId?: string; authorization?: string; userId?: string };

  beforeAll(async () => {
    seen = {};
    upstream = createServer((req, res) => {
      seen = {
        url: req.url,
        correlationId: req.headers['x-correlation-id'] as string | undefined,
        authorization: req.headers.authorization,
        userId: req.headers['x-user-id'] as string | undefined,
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: { path: req.url }, correlationId: 'upstream-id' }));
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const port = (upstream.address() as AddressInfo).port;

    const moduleRef = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [
        ProxyMiddleware,
        AuthContextService,
        { provide: AppLogger, useFactory: () => new AppLogger('Test') },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: string) =>
              key === 'ORDER_SERVICE_URL' ? `http://127.0.0.1:${port}` : fallback,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(
      new AllExceptionsFilter({ logger: new AppLogger('Test'), isProduction: false }),
    );
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    const proxy = new ProxyMiddleware(moduleRef.get(ConfigService), new AppLogger('Test'));
    app.use((req: Request, res: Response, next: NextFunction) => {
      const supplied = req.header('x-correlation-id')?.trim();
      (req as { correlationId?: string }).correlationId =
        supplied !== undefined && supplied.length > 0 ? supplied : 'generated-id';
      void proxy.use(req, res, next);
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  it('routes orders to the upstream service with query and correlation propagation', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/orders/order-1?include=history')
      .set('x-correlation-id', 'test-correlation')
      .set('authorization', 'Bearer token')
      .set('x-user-id', 'customer-1')
      .expect(200);

    expect(seen.url).toBe('/api/v1/orders/order-1?include=history');
    expect(seen.correlationId).toBe('test-correlation');
    expect(seen.authorization).toBe('Bearer token');
    expect(seen.userId).toBe('customer-1');
    expect(response.body.correlationId).toBe('test-correlation');
    expect(response.headers['x-correlation-id']).toBe('test-correlation');
  });

  it('does not duplicate the api prefix for non-inventory services', async () => {
    await request(app.getHttpServer()).get('/api/v1/orders').expect(200);
    expect(seen.url).toBe('/api/v1/orders');
  });

  it('exposes the route table and auth integration point', async () => {
    const routes = await request(app.getHttpServer()).get('/api/v1/gateway/routes').expect(200);
    expect(routes.body.data).toHaveLength(5);

    const context = await request(app.getHttpServer())
      .get('/api/v1/gateway/auth-context')
      .set('authorization', 'Bearer token')
      .set('x-user-id', 'customer-1')
      .expect(200);
    expect(context.body.data).toEqual({ userId: 'customer-1', authenticated: true });
  });
});
