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
  mongodbUriKey?: string;
  enableMongo?: boolean;
}

@Global()
@Module({})
export class FoundationModule implements NestModule {
  static forRoot(options: FoundationModuleOptions): DynamicModule {
    const enableMongo = options.enableMongo ?? options.mongodbUriKey !== undefined;

    if (enableMongo && options.mongodbUriKey === undefined) {
      throw new Error('FoundationModule requires mongodbUriKey when MongoDB is enabled');
    }

    const databaseImports = enableMongo
      ? [DatabaseModule.forRoot(options.mongodbUriKey as string)]
      : [];

    return {
      module: FoundationModule,
      imports: [AppConfigModule.forRoot(), ...databaseImports, RedisModule, KafkaModule],
      controllers: [HealthController],
      providers: [
        { provide: AppLogger, useFactory: () => new AppLogger('OrderFlow') },
        CorrelationMiddleware,
        HealthService,
      ],
      exports: [
        AppConfigModule,
        ...(enableMongo ? [DatabaseModule] : []),
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
