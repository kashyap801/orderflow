import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Payment, PaymentModel } from '../src/payments/payment.schema';
import { PaymentsService } from '../src/payments/payments.service';

const processInput = {
  orderId: 'order-1',
  userId: 'customer-1',
  amountCents: 5000,
  idempotencyKey: 'key-1',
};

function fakeModel() {
  const state = { payments: [] as Payment[], calls: 0, forceDuplicate: false };
  const model = {
    findOne: jest.fn((filter: Record<string, unknown>) => ({
      exec: async () =>
        state.payments.find((payment) => payment.idempotencyKey === filter.idempotencyKey) ?? null,
    })),
    findById: jest.fn((id: string) => ({
      exec: async () => state.payments.find((payment) => payment._id === id) ?? null,
    })),
    find: jest.fn(() => {
      const query = {
        sort: () => query,
        skip: () => query,
        limit: () => query,
        exec: async () => state.payments,
      };
      return query;
    }),
    countDocuments: jest.fn(() => ({ exec: async () => state.payments.length })),
    create: jest.fn(async (input: Partial<Payment>) => {
      state.calls += 1;
      if (state.forceDuplicate) throw { code: 11000 };
      const payment = {
        _id: `p-${state.calls}`,
        paymentId: `p-${state.calls}`,
        refunds: [],
        history: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      } as Payment;
      state.payments.push(payment);
      return payment;
    }),
    findOneAndUpdate: jest.fn(
      (filter: Record<string, unknown>, update: Record<string, unknown>) => ({
        exec: async () => {
          const payment = state.payments.find((candidate) => candidate._id === filter._id);
          if (payment === undefined) return null;
          if (filter.status !== undefined && payment.status !== filter.status) return null;
          const set = update.$set as Partial<Payment> | undefined;
          if (set !== undefined) Object.assign(payment, set);
          const push = update.$push as {
            refunds?: Payment['refunds'][number];
            history?: Payment['history'][number];
          };
          if (push?.refunds !== undefined) payment.refunds.push(push.refunds);
          if (push?.history !== undefined) payment.history.push(push.history);
          return payment;
        },
      }),
    ),
  };
  return { model: model as unknown as PaymentModel, state };
}

describe('PaymentsService unit rules', () => {
  it('processes a simulated successful payment with PENDING then SUCCESS history', async () => {
    const { model } = fakeModel();
    const service = new PaymentsService(model);
    const payment = await service.process(processInput);

    expect(payment.status).toBe('SUCCESS');
    expect(payment.history.map((entry) => entry.status)).toEqual(['PENDING', 'SUCCESS']);
  });

  it('records a simulated failure with a reason', async () => {
    const { model } = fakeModel();
    const service = new PaymentsService(model);
    const payment = await service.process({
      ...processInput,
      simulate: 'FAILURE',
      failureReason: 'Card declined',
    });

    expect(payment.status).toBe('FAILED');
    expect(payment.failureReason).toBe('Card declined');
  });

  it('returns the existing payment for a duplicate idempotency key', async () => {
    const { model, state } = fakeModel();
    const service = new PaymentsService(model);
    const first = await service.process(processInput);
    const second = await service.process({ ...processInput, amountCents: 999999 });

    expect(second._id).toBe(first._id);
    expect(second.amountCents).toBe(5000);
    expect(state.calls).toBe(1);
  });

  it('recovers from a duplicate-key race', async () => {
    const { model, state } = fakeModel();
    const service = new PaymentsService(model);
    const first = await service.process(processInput);
    state.forceDuplicate = true;

    const result = await service.process(processInput);
    expect(result._id).toBe(first._id);
  });

  it('processes a full refund and refuses a second refund', async () => {
    const { model } = fakeModel();
    const service = new PaymentsService(model);
    const payment = await service.process(processInput);
    const refunded = await service.refund(payment._id, { amountCents: 5000, reason: 'Cancelled' });

    expect(refunded.status).toBe('REFUNDED');
    expect(refunded.refunds).toHaveLength(1);
    await expect(service.refund(payment._id, { amountCents: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('processes a partial refund', async () => {
    const { model } = fakeModel();
    const service = new PaymentsService(model);
    const payment = await service.process(processInput);
    const refunded = await service.refund(payment._id, { amountCents: 2000 });

    expect(refunded.status).toBe('PARTIALLY_REFUNDED');
    expect(refunded.refunds[0]?.amountCents).toBe(2000);
  });

  it('refuses refunds above the payment amount and refunds of failed payments', async () => {
    const { model } = fakeModel();
    const service = new PaymentsService(model);
    const payment = await service.process(processInput);
    await expect(service.refund(payment._id, { amountCents: 5001 })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const failed = await service.process({
      ...processInput,
      idempotencyKey: 'key-2',
      simulate: 'FAILURE',
    });
    await expect(service.refund(failed._id, { amountCents: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns not found for an unknown payment', async () => {
    const { model } = fakeModel();
    const service = new PaymentsService(model);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
