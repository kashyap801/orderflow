import { AppLogger, KafkaService } from '@orderflow/common';
import { ORDER_CREATED_TOPIC, type OrderCreatedEvent } from '@orderflow/contracts';
import { OrderEventPublisher } from '../src/events/order-event-publisher';
import type { Order } from '../src/orders/order.schema';

const order = {
  orderId: 'order-1',
  userId: 'customer-1',
  totalAmount: 4998,
  status: 'PENDING',
  items: [
    {
      productId: 'p-1',
      quantity: 2,
    },
  ],
} as Order;

describe('OrderEventPublisher', () => {
  it('publishes a simple ORDER_CREATED envelope', async () => {
    const kafka = {
      enabled: true,
      publish: jest.fn(async () => undefined),
    } as unknown as KafkaService;
    const publisher = new OrderEventPublisher(kafka, new AppLogger('Test'));

    await publisher.publishCreated(order);

    expect(kafka.publish).toHaveBeenCalledTimes(1);
    const [topic, event, key] = (kafka.publish as jest.Mock).mock.calls[0] as [
      string,
      OrderCreatedEvent,
      string,
    ];
    expect(topic).toBe(ORDER_CREATED_TOPIC);
    expect(key).toBe('order-1');
    expect(event.eventType).toBe('ORDER_CREATED');
    expect(event.version).toBe(1);
    expect(event.payload).toMatchObject({
      orderId: 'order-1',
      totalAmountCents: 4998,
      itemCount: 1,
    });
  });

  it('does nothing when Kafka is disabled', async () => {
    const kafka = {
      enabled: false,
      publish: jest.fn(async () => undefined),
    } as unknown as KafkaService;
    const publisher = new OrderEventPublisher(kafka, new AppLogger('Test'));

    await publisher.publishCreated(order);

    expect(kafka.publish).not.toHaveBeenCalled();
  });
});
