import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../src/products/products.service';
import type { ProductModel } from '../src/products/product.schema';

function fakeModel() {
  const state = {
    products: [] as Array<Record<string, unknown>>,
    createCalls: 0,
  };
  const model = {
    create: jest.fn(async (input: Record<string, unknown>) => {
      state.createCalls += 1;
      const product = { _id: `p-${state.createCalls}`, ...input };
      state.products.push(product);
      return product;
    }),
    findById: jest.fn((id: string) => ({
      exec: async () => state.products.find((product) => product._id === id) ?? null,
    })),
    exists: jest.fn((filter: Record<string, unknown>) => ({
      exec: async () =>
        state.products.find(
          (product) =>
            product._id === filter._id &&
            (filter.active === undefined || product.active === filter.active),
        ) ?? null,
    })),
    findOneAndUpdate: jest.fn(
      (filter: Record<string, unknown>, update: Record<string, unknown>) => ({
        exec: async () => {
          const product = state.products.find((candidate) => candidate._id === filter._id);
          if (product === undefined) return null;

          const available = filter.availableQuantity as { $gte?: number } | undefined;
          const reserved = filter.reservedQuantity as { $gte?: number } | undefined;
          if (available?.$gte !== undefined && Number(product.availableQuantity) < available.$gte)
            return null;
          if (reserved?.$gte !== undefined && Number(product.reservedQuantity) < reserved.$gte)
            return null;
          if (filter.active === true && product.active !== true) return null;

          const inc = update.$inc as Record<string, number> | undefined;
          if (inc !== undefined) {
            for (const [field, amount] of Object.entries(inc)) {
              product[field] = Number(product[field]) + amount;
            }
          }
          const set = update.$set as Record<string, unknown> | undefined;
          if (set !== undefined) Object.assign(product, set);
          return product;
        },
      }),
    ),
  };
  return { model: model as unknown as ProductModel, state };
}

describe('ProductsService unit rules', () => {
  it('normalises SKU and defaults reserved quantity on create', async () => {
    const { model, state } = fakeModel();
    const service = new ProductsService(model);

    await service.create({
      name: 'Mouse',
      sku: 'mouse-1',
      priceCents: 2499,
      availableQuantity: 5,
    });

    expect(state.products[0]?.sku).toBe('MOUSE-1');
    expect(state.products[0]?.reservedQuantity).toBe(0);
  });

  it('rejects reservation when stock is insufficient', async () => {
    const { model, state } = fakeModel();
    const service = new ProductsService(model);
    await service.create({
      name: 'Mouse',
      sku: 'mouse-1',
      priceCents: 2499,
      availableQuantity: 1,
    });

    await expect(service.reserve('p-1', 2)).rejects.toBeInstanceOf(ConflictException);
    expect(state.products[0]?.availableQuantity).toBe(1);
    expect(state.products[0]?.reservedQuantity).toBe(0);
  });

  it('reserves and releases stock atomically', async () => {
    const { model, state } = fakeModel();
    const service = new ProductsService(model);
    await service.create({
      name: 'Mouse',
      sku: 'mouse-1',
      priceCents: 2499,
      availableQuantity: 3,
    });

    await service.reserve('p-1', 2);
    expect(state.products[0]).toMatchObject({ availableQuantity: 1, reservedQuantity: 2 });

    await service.release('p-1', 1);
    expect(state.products[0]).toMatchObject({ availableQuantity: 2, reservedQuantity: 1 });
  });

  it('does not reserve inactive products', async () => {
    const { model, state } = fakeModel();
    const service = new ProductsService(model);
    await service.create({
      name: 'Mouse',
      sku: 'mouse-1',
      priceCents: 2499,
      availableQuantity: 5,
    });
    state.products[0]!.active = false;

    await expect(service.reserve('p-1', 1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
