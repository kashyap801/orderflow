import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AllExceptionsFilter,
  ApiResponseInterceptor,
  AppLogger,
  CorrelationMiddleware,
  HealthController,
  HealthService,
  type ReadinessResult,
} from '@orderflow/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

describe('health endpoints', () => {
  let app: INestApplication;
  const logger = new AppLogger('Test');

  const healthService = {
    getLiveness: jest.fn(() => ({
      status: 'ok' as const,
      uptimeSeconds: 1,
      timestamp: '2026-11-25T00:00:00.000Z',
    })),
    getReadiness: jest.fn<Promise<ReadinessResult>, []>(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter({ logger, isProduction: true }));

    const middleware = new CorrelationMiddleware(logger);
    app.use((req: Request, res: Response, next: NextFunction) => middleware.use(req, res, next));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns liveness with a generated correlation id', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body.data.status).toBe('ok');
    expect(response.body.correlationId).toEqual(expect.any(String));
    expect(response.headers['x-correlation-id']).toBe(response.body.correlationId);
  });

  it('returns readiness and echoes a supplied correlation id', async () => {
    healthService.getReadiness.mockResolvedValue({
      status: 'ok',
      uptimeSeconds: 2,
      timestamp: '2026-11-25T00:00:00.000Z',
      checks: {
        mongodb: { status: 'up', latencyMs: 3 },
        redis: { status: 'up' },
        kafka: { status: 'up' },
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .set('X-Correlation-Id', 'test-correlation')
      .expect(200);

    expect(response.body.data.status).toBe('ok');
    expect(response.body.correlationId).toBe('test-correlation');
    expect(response.headers['x-correlation-id']).toBe('test-correlation');
  });

  it('returns a standard 503 error when a dependency is down', async () => {
    healthService.getReadiness.mockResolvedValue({
      status: 'error',
      uptimeSeconds: 3,
      timestamp: '2026-11-25T00:00:00.000Z',
      checks: {
        mongodb: { status: 'down', error: 'not connected' },
        redis: { status: 'up' },
        kafka: { status: 'up' },
      },
    });

    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);

    expect(response.body).toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Dependency readiness check failed',
    });
    expect(response.body.correlationId).toEqual(expect.any(String));
  });
});
