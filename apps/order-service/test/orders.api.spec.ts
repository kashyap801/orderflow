import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter, ApiResponseInterceptor, AppLogger } from '@orderflow/common';
import { createTestDatabase, type TestDatabase } from '@orderflow/testing';
import request from 'supertest';
import { INVENTORY_CLIENT, type InventoryClient } from '../src/orders/inventory-client';
import { ORDER_MODEL, orderModelFactory } from '../src/orders/order.schema';
import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';

const inventory: InventoryClient = {
  async getProduct(productId: string) {
    return {
      _id: productId,
      name: 'API Product',
      sku: 'API-1',
      priceCents: 3000,
      active: true,
      availableQuantity: 4,
    };
  },
};

describe('Orders API', () => {
  let database: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    database = await createTestDatabase('orderflow_order_api_test');
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        OrdersService,
        { provide: ORDER_MODEL, useFactory: orderModelFactory },
        { provide: INVENTORY_CLIENT, useValue: inventory },
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

  async function createOrder() {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({ userId: 'customer-1', items: [{ productId: 'p-1', quantity: 2 }] })
      .expect(201);
    return response.body.data as { _id: string; totalAmount: number };
  }

  it('creates an order with server-computed total', async () => {
    const order = await createOrder();
    expect(order.totalAmount).toBe(6000);
  });

  it('rejects client-supplied prices and totals', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({
        userId: 'customer-1',
        items: [{ productId: 'p-1', quantity: 1, unitPriceCents: 1 }],
        totalAmount: 1,
      })
      .expect(400);
  });

  it('returns 400 when requested quantity exceeds stock', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({ userId: 'customer-1', items: [{ productId: 'p-1', quantity: 5 }] })
      .expect(400);
  });

  it('retrieves an order, customer orders, history and paginated list', async () => {
    const order = await createOrder();

    await request(app.getHttpServer()).get(`/orders/${order._id}`).expect(200);
    const customer = await request(app.getHttpServer())
      .get('/orders/customer/customer-1')
      .expect(200);
    expect(customer.body.data).toHaveLength(1);

    const history = await request(app.getHttpServer())
      .get(`/orders/${order._id}/history`)
      .expect(200);
    expect(history.body.data[0].status).toBe('PENDING');

    const list = await request(app.getHttpServer())
      .get('/orders')
      .query({ page: 1, limit: 10, status: 'PENDING' })
      .expect(200);
    expect(list.body.data.total).toBe(1);
  });

  it('updates status and cancels through the API', async () => {
    const order = await createOrder();
    await request(app.getHttpServer())
      .patch(`/orders/${order._id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/orders/${order._id}/payment-status`)
      .send({ paymentStatus: 'SUCCESS' })
      .expect(200);
    const cancelled = await request(app.getHttpServer())
      .post(`/orders/${order._id}/cancel`)
      .expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
  });

  it('rejects an invalid status transition', async () => {
    const order = await createOrder();
    await request(app.getHttpServer())
      .patch(`/orders/${order._id}/status`)
      .send({ status: 'DELIVERED' })
      .expect(409);
  });
});
