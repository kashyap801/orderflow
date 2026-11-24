import { Global, Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { DatabaseService } from './database/database.service';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { CorrelationMiddleware } from './http/correlation.middleware';
import { KafkaModule } from './infra/kafka.module';
import { KafkaService } from './infra/kafka.service';
import { RedisModule } from './infra/redis.module';
import { RedisService } from './infra/redis.service';
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
      providers: [AppLogger, CorrelationMiddleware, HealthService],
      exports: [
        AppConfigModule,
        AppLogger,
        CorrelationMiddleware,
        DatabaseService,
        HealthService,
        KafkaService,
        RedisService,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
