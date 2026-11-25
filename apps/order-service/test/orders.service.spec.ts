import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { InventoryClient, InventoryProductSnapshot } from '../src/orders/inventory-client';
import type { Order, OrderModel, OrderStatus } from '../src/orders/order.schema';
import { OrdersService } from '../src/orders/orders.service';

function fakeInventory(overrides: Partial<InventoryProductSnapshot> = {}): InventoryClient {
  return {
    async getProduct(productId: string): Promise<InventoryProductSnapshot> {
      return {
        _id: productId,
        name: 'Test Product',
        sku: 'TEST-1',
        priceCents: 2500,
        active: true,
        availableQuantity: 10,
        ...overrides,
      };
    },
  };
}

function fakeModel() {
  const state = { orders: [] as Order[], calls: 0 };
  const model = {
    create: jest.fn(async (input: Partial<Order>) => {
      state.calls += 1;
      const order = {
        _id: `o-${state.calls}`,
        orderId: `o-${state.calls}`,
        history: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      } as Order;
      state.orders.push(order);
      return order;
    }),
    findById: jest.fn((id: string) => ({
      exec: async () => state.orders.find((order) => order._id === id) ?? null,
    })),
    find: jest.fn(() => {
      const query = {
        sort: () => query,
        skip: () => query,
        limit: () => query,
        exec: async () => state.orders,
      };
      return query;
    }),
    countDocuments: jest.fn(() => ({ exec: async () => state.orders.length })),
    findOneAndUpdate: jest.fn(
      (filter: Record<string, unknown>, update: Record<string, unknown>) => ({
        exec: async () => {
          const order = state.orders.find((candidate) => candidate._id === filter._id);
          if (order === null || order === undefined) return null;
          if (filter.status !== undefined && order.status !== filter.status) return null;
          const set = update.$set as Partial<Order> | undefined;
          if (set !== undefined) Object.assign(order, set);
          const push = update.$push as { history?: Order['history'][number] } | undefined;
          if (push?.history !== undefined) order.history.push(push.history);
          return order;
        },
      }),
    ),
  };
  return { model: model as unknown as OrderModel, state };
}

function serviceWith(model: OrderModel, inventory = fakeInventory()) {
  return new OrdersService(model, inventory);
}

describe('OrdersService unit rules', () => {
  it('calculates totals from server-resolved prices, ignoring client price fields', async () => {
    const { model } = fakeModel();
    const service = serviceWith(model);
    const order = await service.create({
      userId: 'customer-1',
      items: [
        { productId: 'p-1', quantity: 2 },
        { productId: 'p-2', quantity: 1 },
      ],
    });

    expect(order.totalAmount).toBe(7500);
    expect(order.items[0]).toMatchObject({ unitPriceCents: 2500, lineTotalCents: 5000 });
    expect(order.status).toBe('PENDING');
    expect(order.paymentStatus).toBe('PENDING');
    expect(order.history).toHaveLength(1);
  });

  it('rejects insufficient stock reported by inventory', async () => {
    const { model, state } = fakeModel();
    const service = serviceWith(model, fakeInventory({ availableQuantity: 1 }));
    await expect(
      service.create({ userId: 'customer-1', items: [{ productId: 'p-1', quantity: 2 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.orders).toHaveLength(0);
  });

  it('rejects inactive products', async () => {
    const { model } = fakeModel();
    const service = serviceWith(model, fakeInventory({ active: false }));
    await expect(
      service.create({ userId: 'customer-1', items: [{ productId: 'p-1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records status transitions in history', async () => {
    const { model } = fakeModel();
    const service = serviceWith(model);
    const order = await service.create({
      userId: 'customer-1',
      items: [{ productId: 'p-1', quantity: 1 }],
    });

    await service.updateStatus(order._id, { status: 'CONFIRMED', note: 'Payment authorised' });
    await service.updateStatus(order._id, { status: 'PROCESSING' });

    const history = await service.history(order._id);
    expect(history.map((entry) => entry.status)).toEqual<OrderStatus[]>([
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
    ]);
    expect(history[1]?.note).toBe('Payment authorised');
  });

  it('rejects invalid status transitions', async () => {
    const { model } = fakeModel();
    const service = serviceWith(model);
    const order = await service.create({
      userId: 'customer-1',
      items: [{ productId: 'p-1', quantity: 1 }],
    });

    await expect(service.updateStatus(order._id, { status: 'DELIVERED' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('cancels a pending order and refuses to cancel a shipped order', async () => {
    const { model } = fakeModel();
    const service = serviceWith(model);
    const order = await service.create({
      userId: 'customer-1',
      items: [{ productId: 'p-1', quantity: 1 }],
    });

    const cancelled = await service.cancel(order._id, 'Customer changed mind');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.history.at(-1)?.note).toBe('Customer changed mind');
    await expect(service.cancel(order._id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found for an unknown order', async () => {
    const { model } = fakeModel();
    const service = serviceWith(model);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
