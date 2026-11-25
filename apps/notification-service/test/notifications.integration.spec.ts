import { createTestDatabase, type TestDatabase } from '@orderflow/testing';
import type { EmailSender } from '../src/notifications/email-sender';
import { notificationModelFactory } from '../src/notifications/notification.schema';
import { NotificationsService } from '../src/notifications/notifications.service';

const sender: EmailSender = {
  async send() {
    return { messageId: `msg-${Math.random().toString(36).slice(2, 8)}`, deliveredAt: new Date() };
  },
};

describe('NotificationsService integration (MongoDB)', () => {
  let database: TestDatabase;
  let service: NotificationsService;

  beforeAll(async () => {
    database = await createTestDatabase('orderflow_notification_test');
    service = new NotificationsService(notificationModelFactory(), sender);
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.clear();
  });

  const input = {
    userId: 'customer-1',
    type: 'PAYMENT_SUCCESS' as const,
    subject: 'Payment received',
    message: 'Your payment was processed.',
    metadata: { paymentId: 'payment-1' },
  };

  it('persists notifications with delivery details', async () => {
    const notification = await service.create(input);
    const stored = await service.findById(notification._id);
    expect(stored.deliveryStatus).toBe('SENT');
    expect(stored.deliveredAt).toBeInstanceOf(Date);
    expect(stored.metadata).toEqual({ paymentId: 'payment-1' });
  });

  it('stores all notification types', async () => {
    const types = [
      'ORDER_CREATED',
      'ORDER_CONFIRMED',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
      'ORDER_CANCELLED',
      'REFUND_COMPLETED',
    ] as const;
    await Promise.all(types.map((type) => service.create({ ...input, type })));
    expect(await service.findByCustomer('customer-1')).toHaveLength(types.length);
  });

  it('persists read state and filters by it', async () => {
    const notification = await service.create(input);
    await service.markRead(notification._id);

    const read = await service.list({ page: 1, limit: 10, isRead: true });
    const unread = await service.list({ page: 1, limit: 10, isRead: false });
    expect(read.total).toBe(1);
    expect(unread.total).toBe(0);
    expect((await service.findById(notification._id)).readAt).toBeInstanceOf(Date);
  });

  it('lists and filters notifications by type', async () => {
    await service.create(input);
    await service.create({ ...input, type: 'ORDER_CANCELLED' });
    const result = await service.list({ page: 1, limit: 1, type: 'PAYMENT_SUCCESS' });
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});
