import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter, ApiResponseInterceptor, AppLogger } from '@orderflow/common';
import { createTestDatabase, type TestDatabase } from '@orderflow/testing';
import request from 'supertest';
import { EMAIL_SENDER, type EmailSender } from '../src/notifications/email-sender';
import {
  NOTIFICATION_MODEL,
  notificationModelFactory,
} from '../src/notifications/notification.schema';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { NotificationsService } from '../src/notifications/notifications.service';

const sender: EmailSender = {
  async send() {
    return { messageId: 'api-msg', deliveredAt: new Date() };
  },
};

describe('Notifications API', () => {
  let database: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    database = await createTestDatabase('orderflow_notification_api_test');
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        { provide: NOTIFICATION_MODEL, useFactory: notificationModelFactory },
        { provide: EMAIL_SENDER, useValue: sender },
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

  function createNotification(type = 'ORDER_CREATED') {
    return request(app.getHttpServer())
      .post('/notifications')
      .send({
        userId: 'customer-1',
        type,
        subject: 'Test notification',
        message: 'Test message',
        metadata: { orderId: 'order-1' },
      });
  }

  it('creates, retrieves and lists notifications', async () => {
    const created = await createNotification().expect(201);
    const id = created.body.data._id as string;

    await request(app.getHttpServer()).get(`/notifications/${id}`).expect(200);
    const customer = await request(app.getHttpServer())
      .get('/notifications/customer/customer-1')
      .expect(200);
    expect(customer.body.data).toHaveLength(1);

    const list = await request(app.getHttpServer())
      .get('/notifications')
      .query({ page: 1, limit: 10, type: 'ORDER_CREATED' })
      .expect(200);
    expect(list.body.data.total).toBe(1);
  });

  it('marks notifications as read and resends', async () => {
    const created = await createNotification().expect(201);
    const id = created.body.data._id as string;

    const read = await request(app.getHttpServer()).patch(`/notifications/${id}/read`).expect(200);
    expect(read.body.data.readAt).toBeDefined();

    const resent = await request(app.getHttpServer())
      .post(`/notifications/${id}/resend`)
      .expect(200);
    expect(resent.body.data.deliveryStatus).toBe('SENT');
  });

  it('rejects unknown notification types and invalid metadata', async () => {
    await request(app.getHttpServer())
      .post('/notifications')
      .send({
        userId: 'customer-1',
        type: 'UNKNOWN',
        subject: 'Bad',
        message: 'Bad',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/notifications')
      .send({
        userId: 'customer-1',
        type: 'ORDER_CREATED',
        subject: 'Bad',
        message: 'Bad',
        metadata: 'not-an-object',
      })
      .expect(400);
  });
});
