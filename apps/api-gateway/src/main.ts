import 'reflect-metadata';
import { bootstrapService } from '@orderflow/common';
import { AppModule } from './app.module';

bootstrapService({
  module: AppModule,
  name: 'API Gateway',
  description:
    'Centralized REST routing, JWT verification, basic roles, correlation IDs and validation.',
  portEnvKey: 'PORT_API_GATEWAY',
}).catch((error: unknown) => {
  console.error('Failed to start API Gateway', error);
  process.exitCode = 1;
});
