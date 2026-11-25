import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter, ApiResponseInterceptor, AppLogger } from '@orderflow/common';
import { createTestDatabase, type TestDatabase } from '@orderflow/testing';
import request from 'supertest';
import { PAYMENT_MODEL, paymentModelFactory } from '../src/payments/payment.schema';
import { PaymentsController } from '../src/payments/payments.controller';
import { PaymentsService } from '../src/payments/payments.service';

describe('Payments API', () => {
  let database: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    database = await createTestDatabase('orderflow_payment_api_test');
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        { provide: PAYMENT_MODEL, useFactory: paymentModelFactory },
        { provide: AppLogger, useFactory: () => new AppLogger('Test') },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(
      new AllExceptionsFilter({ logger: new AppLogger('Test'), isProduction: false }),
    );
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  beforeEach(async () => {
    await database.clear();
  });

  function sendPayment(overrides: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post('/payments/process')
      .send({
        orderId: 'order-1',
        userId: 'customer-1',
        amountCents: 5000,
        idempotencyKey: `api-${Math.random().toString(36).slice(2, 10)}`,
        ...overrides,
      });
  }

  it('processes, retrieves and lists a payment', async () => {
    const created = await sendPayment().expect(201);
    const id = created.body.data._id as string;
    expect(created.body.data.status).toBe('SUCCESS');

    await request(app.getHttpServer()).get(`/payments/${id}`).expect(200);
    await request(app.getHttpServer()).get(`/payments/order/order-1`).expect(200);
    await request(app.getHttpServer()).get(`/payments/customer/customer-1`).expect(200);
    const list = await request(app.getHttpServer())
      .get('/payments')
      .query({ page: 1, limit: 10, status: 'SUCCESS' })
      .expect(200);
    expect(list.body.data.total).toBe(1);
  });

  it('returns the same payment for a duplicate idempotency key', async () => {
    const first = await sendPayment({ idempotencyKey: 'duplicate-api' }).expect(201);
    const second = await sendPayment({ idempotencyKey: 'duplicate-api', amountCents: 999 }).expect(
      201,
    );

    expect(second.body.data._id).toBe(first.body.data._id);
    expect(second.body.data.amountCents).toBe(5000);
  });

  it('simulates failure and rejects refunds on failed payments', async () => {
    const created = await sendPayment({ idempotencyKey: 'failed-api', simulate: 'FAILURE' }).expect(
      201,
    );
    expect(created.body.data.status).toBe('FAILED');
    await request(app.getHttpServer())
      .post(`/payments/${created.body.data._id}/refunds`)
      .send({ amountCents: 100 })
      .expect(400);
  });

  it('rejects invalid amounts and missing idempotency keys', async () => {
    await sendPayment({ amountCents: -1 }).expect(400);
    await sendPayment({ idempotencyKey: undefined }).expect(400);
  });

  it('refunds partially then fully', async () => {
    const created = await sendPayment().expect(201);
    const id = created.body.data._id as string;
    const partial = await request(app.getHttpServer())
      .post(`/payments/${id}/refunds`)
      .send({ amountCents: 2000 })
      .expect(200);
    expect(partial.body.data.status).toBe('PARTIALLY_REFUNDED');

    const full = await request(app.getHttpServer())
      .post(`/payments/${id}/refunds`)
      .send({ amountCents: 3000 })
      .expect(200);
    expect(full.body.data.status).toBe('REFUNDED');
  });
});
