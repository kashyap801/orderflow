import { NotFoundException } from '@nestjs/common';
import type { EmailSender } from '../src/notifications/email-sender';
import type { Notification, NotificationModel } from '../src/notifications/notification.schema';
import { NotificationsService } from '../src/notifications/notifications.service';

const sender: EmailSender = {
  async send() {
    return { messageId: 'msg-1', deliveredAt: new Date('2026-01-01T00:00:00.000Z') };
  },
};

const input = {
  userId: 'customer-1',
  type: 'ORDER_CREATED' as const,
  subject: 'Order created',
  message: 'Your order was received.',
  metadata: { orderId: 'order-1' },
};

function fakeModel() {
  const state = { notifications: [] as Notification[] };
  const model = {
    create: jest.fn(async (value: Partial<Notification>) => {
      const notification = {
        readAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...value,
      } as Notification;
      state.notifications.push(notification);
      return notification;
    }),
    findById: jest.fn((id: string) => ({
      exec: async () => state.notifications.find((item) => item._id === id) ?? null,
    })),
    find: jest.fn(() => {
      const query = {
        sort: () => query,
        skip: () => query,
        limit: () => query,
        exec: async () => state.notifications,
      };
      return query;
    }),
    countDocuments: jest.fn(() => ({ exec: async () => state.notifications.length })),
    findOneAndUpdate: jest.fn(
      (filter: Record<string, unknown>, update: Record<string, unknown>) => ({
        exec: async () => {
          const notification = state.notifications.find((item) => item._id === filter._id);
          if (notification === undefined) return null;
          Object.assign(notification, (update.$set ?? {}) as Partial<Notification>);
          return notification;
        },
      }),
    ),
  };
  return { model: model as unknown as NotificationModel, state };
}

describe('NotificationsService unit rules', () => {
  it('creates a notification and records simulated email delivery', async () => {
    const { model } = fakeModel();
    const service = new NotificationsService(model, sender);
    const notification = await service.create(input);

    expect(notification.deliveryStatus).toBe('SENT');
    expect(notification.deliveryMessageId).toBe('msg-1');
    expect(notification.metadata).toEqual({ orderId: 'order-1' });
  });

  it('records a failed delivery without throwing', async () => {
    const { model } = fakeModel();
    const failingSender: EmailSender = {
      async send() {
        throw new Error('simulated outage');
      },
    };
    const service = new NotificationsService(model, failingSender);
    const notification = await service.create(input);
    expect(notification.deliveryStatus).toBe('FAILED');
  });

  it('marks notifications as read idempotently', async () => {
    const { model } = fakeModel();
    const service = new NotificationsService(model, sender);
    const notification = await service.create(input);

    const first = await service.markRead(notification._id);
    const second = await service.markRead(notification._id);
    expect(first.readAt).toBeInstanceOf(Date);
    expect(second.readAt).toEqual(first.readAt);
  });

  it('retrieves customer history and lists with read filters', async () => {
    const { model } = fakeModel();
    const service = new NotificationsService(model, sender);
    await service.create(input);
    expect(await service.findByCustomer('customer-1')).toHaveLength(1);
    expect((await service.list({ page: 1, limit: 10, isRead: false })).total).toBe(1);
  });

  it('retries simulated delivery', async () => {
    const { model } = fakeModel();
    const service = new NotificationsService(model, sender);
    const notification = await service.create(input);
    const resent = await service.resend(notification._id);
    expect(resent.deliveryStatus).toBe('SENT');
  });

  it('returns not found for unknown notifications', async () => {
    const { model } = fakeModel();
    const service = new NotificationsService(model, sender);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
