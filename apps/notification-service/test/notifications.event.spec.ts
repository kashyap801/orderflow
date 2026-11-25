import type { EmailSender } from '../src/notifications/email-sender';
import type { Notification, NotificationModel } from '../src/notifications/notification.schema';
import { NotificationsService } from '../src/notifications/notifications.service';

const event = {
  eventId: 'event-1',
  eventType: 'ORDER_CREATED',
  version: 1 as const,
  correlationId: 'corr-1',
  occurredAt: '2026-11-25T00:00:00.000Z',
  producer: 'order-service',
  payload: {
    orderId: 'order-1',
    userId: 'customer-1',
    totalAmountCents: 1999,
    itemCount: 1,
    status: 'PENDING',
  },
};

const sender: EmailSender = {
  async send() {
    return { messageId: 'msg-event', deliveredAt: new Date() };
  },
};

describe('NotificationsService event handling', () => {
  it('creates once and reuses the notification for a duplicate event', async () => {
    const state = { existing: null as Notification | null };
    const model = {
      findOne: jest.fn(() => ({
        exec: async () => state.existing,
      })),
      create: jest.fn(async (value: Partial<Notification>) => {
        const notification = {
          createdAt: new Date(),
          updatedAt: new Date(),
          ...value,
        } as Notification;
        state.existing = notification;
        return notification;
      }),
    } as unknown as NotificationModel;
    const service = new NotificationsService(model, sender);

    const first = await service.createFromOrderCreated(event);
    const second = await service.createFromOrderCreated(event);

    expect(first?.eventId).toBe('event-1');
    expect(second?._id).toBe(first?._id);
    expect(model.create).toHaveBeenCalledTimes(1);
  });
});
