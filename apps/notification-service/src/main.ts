import 'reflect-metadata';
import { bootstrapService } from '@orderflow/common';
import { AppModule } from './app.module';

bootstrapService({
  module: AppModule,
  name: 'Notification Service',
  description: 'Notification domain API: history, read state and simulated email delivery.',
  portEnvKey: 'PORT_NOTIFICATION_SERVICE',
}).catch((error: unknown) => {
  console.error('Failed to start Notification Service', error);
  process.exitCode = 1;
});
