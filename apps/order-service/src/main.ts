import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  AllExceptionsFilter,
  ApiResponseInterceptor,
  AppLogger,
  setupSwagger,
} from '@orderflow/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(AppLogger);

  app.useLogger(logger);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new AllExceptionsFilter({
      logger,
      isProduction: config.get<string>('NODE_ENV') === 'production',
    }),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  setupSwagger(app, {
    title: 'OrderFlow — Order Service Foundation',
    description: 'Phase 2 backend foundation: health, readiness and shared infrastructure checks.',
  });

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  logger.log(`Order Service foundation listening on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  // Bootstrap errors happen before the Nest logger is available.
  console.error('Failed to start Order Service', error);
  process.exitCode = 1;
});
