import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiResponseInterceptor, AllExceptionsFilter, AppLogger } from '@orderflow/common';
import { createTestDatabase, type TestDatabase } from '@orderflow/testing';
import request from 'supertest';
import { ProductsController } from '../src/products/products.controller';
import { PRODUCT_MODEL, productModelFactory } from '../src/products/product.schema';
import { ProductsService } from '../src/products/products.service';

describe('Products API', () => {
  let database: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    database = await createTestDatabase('orderflow_inventory_api_test');
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        { provide: PRODUCT_MODEL, useFactory: productModelFactory },
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

  async function createProduct(overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post('/products')
      .send({
        name: 'API Product',
        sku: `API-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        priceCents: 1999,
        availableQuantity: 5,
        ...overrides,
      })
      .expect(201);
    return response.body.data as { _id: string; sku: string };
  }

  it('creates and retrieves a product', async () => {
    const product = await createProduct();
    const response = await request(app.getHttpServer()).get(`/products/${product._id}`).expect(200);
    expect(response.body.data).toMatchObject({ sku: product.sku, availableQuantity: 5 });
    expect(response.body.correlationId).toBeDefined();
  });

  it('rejects non-integer or negative prices', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Bad', sku: 'BAD', priceCents: 10.5, availableQuantity: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Bad', sku: 'BAD', priceCents: -1, availableQuantity: 1 })
      .expect(400);
  });

  it('rejects untrusted extra fields', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({
        name: 'Bad',
        sku: 'BAD',
        priceCents: 100,
        availableQuantity: 1,
        reservedQuantity: 999,
      })
      .expect(400);
  });

  it('returns 409 for insufficient stock on reserve', async () => {
    const product = await createProduct({ availableQuantity: 1 });
    await request(app.getHttpServer())
      .post(`/products/${product._id}/reserve`)
      .send({ quantity: 2 })
      .expect(409);
    const check = await request(app.getHttpServer()).get(`/products/${product._id}`).expect(200);
    expect(check.body.data).toMatchObject({ availableQuantity: 1, reservedQuantity: 0 });
  });

  it('checks availability, reserves, releases and deactivates', async () => {
    const product = await createProduct({ availableQuantity: 2 });

    const available = await request(app.getHttpServer())
      .get(`/products/${product._id}/availability`)
      .query({ quantity: 2 })
      .expect(200);
    expect(available.body.data.available).toBe(true);

    await request(app.getHttpServer())
      .post(`/products/${product._id}/reserve`)
      .send({ quantity: 2 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/products/${product._id}/release`)
      .send({ quantity: 1 })
      .expect(200);
    const deactivated = await request(app.getHttpServer())
      .delete(`/products/${product._id}`)
      .expect(200);
    expect(deactivated.body.data.active).toBe(false);
  });
});
