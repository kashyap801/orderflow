import 'reflect-metadata';
import { ValidationPipe, type Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from '../http/all-exceptions.filter';
import { ApiResponseInterceptor } from '../http/api-response.interceptor';
import { AppLogger } from '../logging/app-logger';
import { setupSwagger } from '../swagger/setup-swagger';

export interface BootstrapServiceOptions {
  module: Type<unknown>;
  name: string;
  description: string;
  portEnvKey?: string;
  swaggerPath?: string;
}

export async function bootstrapService(options: BootstrapServiceOptions): Promise<void> {
  const app = await NestFactory.create(options.module, { bufferLogs: true });
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
    title: `${options.name} API`,
    description: options.description,
    path: options.swaggerPath ?? 'api/v1/docs',
  });

  const rawPort = config.get<string | number>(options.portEnvKey ?? 'PORT', 3001);
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid port configuration: ${options.portEnvKey ?? 'PORT'}=${String(rawPort)}`,
    );
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`${options.name} listening on port ${port}`);
}
