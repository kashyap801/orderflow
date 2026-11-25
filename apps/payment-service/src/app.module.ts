import { Module } from '@nestjs/common';
import { FoundationModule } from '@orderflow/common';
import { PAYMENT_MODEL, paymentModelFactory } from './payments/payment.schema';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';

@Module({
  imports: [
    FoundationModule.forRoot({
      mongodbUriKey: 'MONGODB_URI_PAYMENT',
    }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: PAYMENT_MODEL, useFactory: paymentModelFactory }],
})
export class AppModule {}
