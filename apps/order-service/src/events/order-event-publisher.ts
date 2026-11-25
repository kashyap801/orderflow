import { Injectable } from '@nestjs/common';
import { AppLogger, CorrelationContext, createId, KafkaService } from '@orderflow/common';
import { ORDER_CREATED_TOPIC, type OrderCreatedEvent } from '@orderflow/contracts';
import type { Order } from '../orders/order.schema';

@Injectable()
export class OrderEventPublisher {
  private readonly logger: AppLogger;

  constructor(
    private readonly kafka: KafkaService,
    logger: AppLogger,
  ) {
    this.logger = logger.withContext('OrderEvents');
  }

  async publishCreated(order: Order): Promise<void> {
    if (!this.kafka.enabled) return;

    const event: OrderCreatedEvent = {
      eventId: createId(),
      eventType: 'ORDER_CREATED',
      version: 1,
      correlationId: CorrelationContext.getId() ?? createId(),
      occurredAt: new Date().toISOString(),
      producer: 'order-service',
      payload: {
        orderId: order.orderId,
        userId: order.userId,
        totalAmountCents: order.totalAmount,
        itemCount: order.items.length,
        status: order.status,
      },
    };

    try {
      await this.kafka.publish(ORDER_CREATED_TOPIC, event, order.orderId);
      this.logger.log(`Published ORDER_CREATED for ${order.orderId}`);
    } catch (error) {
      this.logger.warn(`Could not publish ORDER_CREATED for ${order.orderId}`, error);
    }
  }
}
