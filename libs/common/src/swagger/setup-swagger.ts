import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export interface SwaggerOptions {
  title: string;
  description: string;
  path?: string;
}

export function setupSwagger(app: INestApplication, options: SwaggerOptions): void {
  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addTag('Health')
    .build();

  SwaggerModule.setup(
    options.path ?? 'api/v1/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
}
