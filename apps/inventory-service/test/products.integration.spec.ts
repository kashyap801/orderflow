import { ConflictException } from '@nestjs/common';
import { createTestDatabase, type TestDatabase } from '@orderflow/testing';
import { ProductsService } from '../src/products/products.service';
import { productModelFactory } from '../src/products/product.schema';

describe('ProductsService integration (MongoDB)', () => {
  let database: TestDatabase;
  let service: ProductsService;

  beforeAll(async () => {
    database = await createTestDatabase('orderflow_inventory_test');
    service = new ProductsService(productModelFactory());
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.clear();
  });

  async function seedProduct(availableQuantity: number) {
    return service.create({
      name: 'Concurrent Product',
      sku: `SKU-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      priceCents: 1000,
      availableQuantity,
    });
  }

  it('persists products and enforces unique SKU', async () => {
    const product = await seedProduct(5);
    const stored = await service.findById(product._id);
    expect(stored).toMatchObject({ availableQuantity: 5, reservedQuantity: 0 });
    await expect(
      service.create({
        name: 'Duplicate',
        sku: product.sku.toLowerCase(),
        priceCents: 500,
        availableQuantity: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents overselling under concurrent reservations', async () => {
    const product = await seedProduct(3);
    const attempts = Array.from({ length: 10 }, () =>
      service.reserve(product._id, 1).then(
        () => 'ok' as const,
        () => 'failed' as const,
      ),
    );
    const results = await Promise.all(attempts);

    expect(results.filter((result) => result === 'ok')).toHaveLength(3);
    expect(results.filter((result) => result === 'failed')).toHaveLength(7);

    const updated = await service.findById(product._id);
    expect(updated.availableQuantity).toBe(0);
    expect(updated.reservedQuantity).toBe(3);
  });

  it('rejects insufficient stock and keeps quantities unchanged', async () => {
    const product = await seedProduct(1);
    await expect(service.reserve(product._id, 2)).rejects.toBeInstanceOf(ConflictException);

    const updated = await service.findById(product._id);
    expect(updated.availableQuantity).toBe(1);
    expect(updated.reservedQuantity).toBe(0);
  });

  it('restocks and releases reserved inventory', async () => {
    const product = await seedProduct(2);
    await service.reserve(product._id, 2);
    await service.release(product._id, 1);
    await service.restock(product._id, 4);

    const updated = await service.findById(product._id);
    expect(updated).toMatchObject({ availableQuantity: 5, reservedQuantity: 1 });
  });

  it('lists and filters products with pagination', async () => {
    await seedProduct(1);
    await seedProduct(2);
    const list = await service.list({ page: 1, limit: 1, active: true });
    expect(list.total).toBe(2);
    expect(list.totalPages).toBe(2);
    expect(list.items).toHaveLength(1);
  });
});
