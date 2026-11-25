import 'reflect-metadata';
import { bootstrapService } from '@orderflow/common';
import { AppModule } from './app.module';

bootstrapService({
  module: AppModule,
  name: 'Order Service',
  description: 'Order domain API: orders, status history and customer order queries.',
}).catch((error: unknown) => {
  // Bootstrap errors happen before the Nest logger is available.
  console.error('Failed to start Order Service', error);
  process.exitCode = 1;
});
