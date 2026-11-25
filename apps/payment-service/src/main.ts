import 'reflect-metadata';
import { bootstrapService } from '@orderflow/common';
import { AppModule } from './app.module';

bootstrapService({
  module: AppModule,
  name: 'Payment Service',
  description: 'Payment domain API: simulated processing, idempotency, refunds and history.',
  portEnvKey: 'PORT_PAYMENT_SERVICE',
}).catch((error: unknown) => {
  console.error('Failed to start Payment Service', error);
  process.exitCode = 1;
});
