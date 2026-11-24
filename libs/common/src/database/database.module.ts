import { Module, type DynamicModule } from '@nestjs/common';
import { DatabaseService, MONGODB_URI_ENV_KEY } from './database.service';

@Module({})
export class DatabaseModule {
  static forRoot(uriEnvKey: string): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [{ provide: MONGODB_URI_ENV_KEY, useValue: uriEnvKey }, DatabaseService],
      exports: [DatabaseService],
    };
  }
}
