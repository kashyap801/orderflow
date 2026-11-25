import { createTestDatabase, type TestDatabase } from '@orderflow/testing';
import { paymentModelFactory, type PaymentModel } from '../src/payments/payment.schema';
import { PaymentsService } from '../src/payments/payments.service';

describe('PaymentsService integration (MongoDB)', () => {
  let database: TestDatabase;
  let model: PaymentModel;
  let service: PaymentsService;

  beforeAll(async () => {
    database = await createTestDatabase('orderflow_payment_test');
    model = paymentModelFactory();
    await model.init();
    service = new PaymentsService(model);
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.clear();
  });

  const input = {
    orderId: 'order-1',
    userId: 'customer-1',
    amountCents: 4000,
    idempotencyKey: 'idem-1',
  };

  it('persists a processed payment and its history', async () => {
    const payment = await service.process(input);
    const stored = await service.findById(payment._id);
    expect(stored.status).toBe('SUCCESS');
    expect(stored.history.map((entry) => entry.status)).toEqual(['PENDING', 'SUCCESS']);
    expect(await service.history(payment._id)).toHaveLength(2);
  });

  it('processes duplicate idempotency keys exactly once under concurrency', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => service.process(input)));

    const ids = new Set(results.map((payment) => payment._id));
    expect(ids.size).toBe(1);
    expect(await model.countDocuments({ idempotencyKey: 'idem-1' })).toBe(1);
  });

  it('keeps simulated failures distinct from retries with new keys', async () => {
    const failed = await service.process({
      ...input,
      idempotencyKey: 'fail-1',
      simulate: 'FAILURE',
    });
    const succeeded = await service.process({ ...input, idempotencyKey: 'ok-1' });
    expect(failed.status).toBe('FAILED');
    expect(succeeded.status).toBe('SUCCESS');
    expect(await service.findByCustomer('customer-1')).toHaveLength(2);
    expect(await service.findByOrderId('order-1')).toHaveLength(2);
  });

  it('persists partial and full refunds', async () => {
    const payment = await service.process(input);
    await service.refund(payment._id, { amountCents: 1500 });
    const fullyRefunded = await service.refund(payment._id, { amountCents: 2500 });

    expect(fullyRefunded.status).toBe('REFUNDED');
    expect(fullyRefunded.refunds).toHaveLength(2);
    expect(fullyRefunded.history.map((entry) => entry.status)).toEqual([
      'PENDING',
      'SUCCESS',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
    ]);
  });

  it('lists and filters payments', async () => {
    await service.process(input);
    await service.process({ ...input, idempotencyKey: 'idem-2', userId: 'customer-2' });
    const result = await service.list({ page: 1, limit: 1, status: 'SUCCESS' });
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(1);
  });
});
