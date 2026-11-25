import { RedisService } from '@orderflow/common';
import type { Product, ProductModel } from '../src/products/product.schema';
import { ProductsService } from '../src/products/products.service';

const product = {
  _id: 'p-1',
  name: 'Cached Product',
  sku: 'CACHED-1',
  priceCents: 1000,
  availableQuantity: 5,
  reservedQuantity: 0,
  active: true,
} as Product;

function fakeRedis() {
  const values = new Map<string, string>();
  const client = {
    get: jest.fn(async (key: string) => values.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      values.delete(key);
      return 1;
    }),
    incr: jest.fn(async (key: string) => {
      const next = Number(values.get(key) ?? 0) + 1;
      values.set(key, String(next));
      return next;
    }),
  };
  const redis = {
    enabled: true,
    getClient: () => client,
  } as unknown as RedisService;
  return { redis, client, values };
}

describe('ProductsService Redis cache', () => {
  it('serves repeated product reads from the cache', async () => {
    const { redis, client } = fakeRedis();
    const model = {
      findById: jest.fn(() => ({ exec: async () => product })),
    } as unknown as ProductModel;
    const service = new ProductsService(model, redis);

    const first = await service.findById('p-1');
    const second = await service.findById('p-1');

    expect(model.findById).toHaveBeenCalledTimes(1);
    expect(first._id).toBe('p-1');
    expect(second._id).toBe('p-1');
    expect(client.set).toHaveBeenCalled();
  });

  it('invalidates the cached product after an update', async () => {
    const { redis, client, values } = fakeRedis();
    values.set('product:p-1', JSON.stringify(product));
    const model = {
      findOneAndUpdate: jest.fn(() => ({
        exec: async () => ({ ...product, name: 'Updated' }),
      })),
    } as unknown as ProductModel;
    const service = new ProductsService(model, redis);

    await service.update('p-1', { name: 'Updated' });

    expect(client.del).toHaveBeenCalledWith('product:p-1');
    expect(client.incr).toHaveBeenCalledWith('products:list:version');
  });
});
