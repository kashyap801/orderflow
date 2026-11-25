import { ConfigService } from '@nestjs/config';
import { AppLogger, KafkaService } from '@orderflow/common';
import { ORDER_CREATED_TOPIC, type OrderCreatedEvent } from '@orderflow/contracts';
import { OrderCreatedConsumer } from '../src/events/order-created.consumer';
import type { NotificationsService } from '../src/notifications/notifications.service';

const event: OrderCreatedEvent = {
  eventId: 'event-1',
  eventType: 'ORDER_CREATED',
  version: 1,
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

describe('OrderCreatedConsumer', () => {
  it('subscribes to the simple topic and creates a notification', async () => {
    let handler: ((value: OrderCreatedEvent) => Promise<void>) | undefined;
    const kafka = {
      consume: jest.fn(
        async (
          _topic: string,
          _groupId: string,
          callback: (value: OrderCreatedEvent) => Promise<void>,
        ) => {
          handler = callback;
        },
      ),
    } as unknown as KafkaService;
    const notifications = {
      createFromOrderCreated: jest.fn(async () => ({ _id: 'notification-1' })),
    } as unknown as NotificationsService;
    const config = {
      get: jest.fn(() => 'test-group'),
    } as unknown as ConfigService;
    const consumer = new OrderCreatedConsumer(kafka, notifications, config, new AppLogger('Test'));

    await consumer.onApplicationBootstrap();

    expect(kafka.consume).toHaveBeenCalledWith(
      ORDER_CREATED_TOPIC,
      'test-group',
      expect.any(Function),
    );
    await handler?.(event);
    expect(notifications.createFromOrderCreated).toHaveBeenCalledWith(event);
  });

  it('ignores malformed events', async () => {
    let handler: ((value: OrderCreatedEvent) => Promise<void>) | undefined;
    const kafka = {
      consume: jest.fn(
        async (
          _topic: string,
          _groupId: string,
          callback: (value: OrderCreatedEvent) => Promise<void>,
        ) => {
          handler = callback;
        },
      ),
    } as unknown as KafkaService;
    const notifications = {
      createFromOrderCreated: jest.fn(async () => undefined),
    } as unknown as NotificationsService;
    const config = { get: jest.fn(() => 'test-group') } as unknown as ConfigService;
    const consumer = new OrderCreatedConsumer(kafka, notifications, config, new AppLogger('Test'));

    await consumer.onApplicationBootstrap();
    await handler?.({ ...event, eventType: 'SOMETHING_ELSE' });

    expect(notifications.createFromOrderCreated).not.toHaveBeenCalled();
  });
});
