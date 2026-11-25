import { Module } from '@nestjs/common';
import { FoundationModule } from '@orderflow/common';
import { OrderCreatedConsumer } from './events/order-created.consumer';
import { EMAIL_SENDER, SimulatedEmailSender } from './notifications/email-sender';
import { NOTIFICATION_MODEL, notificationModelFactory } from './notifications/notification.schema';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';

@Module({
  imports: [
    FoundationModule.forRoot({
      mongodbUriKey: 'MONGODB_URI_NOTIFICATION',
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    OrderCreatedConsumer,
    { provide: NOTIFICATION_MODEL, useFactory: notificationModelFactory },
    { provide: EMAIL_SENDER, useClass: SimulatedEmailSender },
  ],
  exports: [NotificationsService],
})
export class AppModule {}
