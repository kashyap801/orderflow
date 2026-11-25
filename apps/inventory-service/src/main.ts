import 'reflect-metadata';
import { bootstrapService } from '@orderflow/common';
import { AppModule } from './app.module';

bootstrapService({
  module: AppModule,
  name: 'Inventory Service',
  description: 'Inventory domain API: products, stock levels and atomic reservations.',
  portEnvKey: 'PORT_INVENTORY_SERVICE',
}).catch((error: unknown) => {
  console.error('Failed to start Inventory Service', error);
  process.exitCode = 1;
});
