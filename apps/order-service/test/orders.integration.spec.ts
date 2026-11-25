import { ConflictException } from '@nestjs/common';
import { createTestDatabase, type TestDatabase } from '@orderflow/testing';
import type { InventoryClient, InventoryProductSnapshot } from '../src/orders/inventory-client';
import { orderModelFactory } from '../src/orders/order.schema';
import { OrdersService } from '../src/orders/orders.service';

const inventory: InventoryClient = {
  async getProduct(productId: string): Promise<InventoryProductSnapshot> {
    return {
      _id: productId,
      name: 'Persistent Product',
      sku: 'PERSIST-1',
      priceCents: 1250,
      active: true,
      availableQuantity: 100,
    };
  },
};

describe('OrdersService integration (MongoDB)', () => {
  let database: TestDatabase;
  let service: OrdersService;

  beforeAll(async () => {
    database = await createTestDatabase('orderflow_order_test');
    service = new OrdersService(orderModelFactory(), inventory);
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.clear();
  });

  async function createOrder(userId = 'customer-1', quantity = 1) {
    return service.create({ userId, items: [{ productId: 'p-1', quantity }] });
  }

  it('persists orders with server-calculated totals', async () => {
    const order = await createOrder('customer-1', 3);
    const stored = await service.findById(order._id);
    expect(stored.totalAmount).toBe(3750);
    expect(stored.orderId).toBe(order.orderId);
    expect(stored.history).toHaveLength(1);
  });

  it('retrieves all orders for a customer', async () => {
    await createOrder('customer-1');
    await createOrder('customer-1');
    await createOrder('customer-2');
    expect(await service.findByCustomer('customer-1')).toHaveLength(2);
  });

  it('lists and filters orders with pagination', async () => {
    await createOrder('customer-1');
    await createOrder('customer-2');
    const result = await service.list({ page: 1, limit: 1, status: 'PENDING' });
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it('cancels an order and persists status history', async () => {
    const order = await createOrder();
    await service.cancel(order._id, 'No longer needed');

    const stored = await service.findById(order._id);
    expect(stored.status).toBe('CANCELLED');
    expect(stored.history.map((entry) => entry.status)).toEqual(['PENDING', 'CANCELLED']);
    expect(stored.history[1]?.note).toBe('No longer needed');
  });

  it('prevents concurrent conflicting status updates', async () => {
    const order = await createOrder();
    const results = await Promise.all([
      service.updateStatus(order._id, { status: 'CONFIRMED' }).then(
        () => 'ok' as const,
        () => 'failed' as const,
      ),
      service.updateStatus(order._id, { status: 'FAILED' }).then(
        () => 'ok' as const,
        () => 'failed' as const,
      ),
    ]);

    expect(results.filter((result) => result === 'ok')).toHaveLength(1);
    expect(results.filter((result) => result === 'failed')).toHaveLength(1);
  });

  it('refuses cancellation after shipment', async () => {
    const order = await createOrder();
    await service.updateStatus(order._id, { status: 'CONFIRMED' });
    await service.updateStatus(order._id, { status: 'PROCESSING' });
    await service.updateStatus(order._id, { status: 'SHIPPED' });
    await expect(service.cancel(order._id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates payment status independently', async () => {
    const order = await createOrder();
    const updated = await service.updatePaymentStatus(order._id, 'SUCCESS');
    expect(updated.paymentStatus).toBe('SUCCESS');
  });
});
