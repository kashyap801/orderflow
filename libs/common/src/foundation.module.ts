import {
  Global,
  Module,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { CorrelationMiddleware } from './http/correlation.middleware';
import { KafkaModule } from './infra/kafka.module';
import { RedisModule } from './infra/redis.module';
import { AppLogger } from './logging/app-logger';

export interface FoundationModuleOptions {
  mongodbUriKey: string;
}

@Global()
@Module({})
export class FoundationModule implements NestModule {
  static forRoot(options: FoundationModuleOptions): DynamicModule {
    return {
      module: FoundationModule,
      imports: [
        AppConfigModule.forRoot(),
        DatabaseModule.forRoot(options.mongodbUriKey),
        RedisModule,
        KafkaModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: AppLogger, useFactory: () => new AppLogger('OrderFlow') },
        CorrelationMiddleware,
        HealthService,
      ],
      exports: [
        AppConfigModule,
        DatabaseModule,
        RedisModule,
        KafkaModule,
        AppLogger,
        CorrelationMiddleware,
        HealthService,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
