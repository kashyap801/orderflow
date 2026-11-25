import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger, KafkaService } from '@orderflow/common';
import { ORDER_CREATED_TOPIC, type OrderCreatedEvent } from '@orderflow/contracts';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrderCreatedConsumer implements OnApplicationBootstrap {
  private readonly logger: AppLogger;

  constructor(
    private readonly kafka: KafkaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    logger: AppLogger,
  ) {
    this.logger = logger.withContext('OrderCreatedConsumer');
  }

  async onApplicationBootstrap(): Promise<void> {
    const groupId = this.config.get<string>('KAFKA_CONSUMER_GROUP_ID', 'orderflow-notification');

    await this.kafka.consume<OrderCreatedEvent>(ORDER_CREATED_TOPIC, groupId, async (event) => {
      if (event.eventType !== 'ORDER_CREATED' || event.payload?.orderId === undefined) {
        this.logger.warn('Ignoring malformed ORDER_CREATED event');
        return;
      }

      const notification = await this.notifications.createFromOrderCreated(event);
      this.logger.log(
        notification === undefined
          ? `Duplicate ORDER_CREATED ignored for ${event.eventId}`
          : `Notification ready for order ${event.payload.orderId}`,
      );
    });
  }
}
