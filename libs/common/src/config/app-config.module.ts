import { Global, Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './env.validation';

export interface AppConfigModuleOptions {
  envFilePath?: string[];
}

@Global()
@Module({})
export class AppConfigModule {
  static forRoot(options: AppConfigModuleOptions = {}): DynamicModule {
    const nodeEnvironment = process.env.NODE_ENV ?? 'development';

    return {
      module: AppConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          envFilePath: options.envFilePath ?? [`.env.${nodeEnvironment}`, '.env'],
          validate: validateEnvironment,
        }),
      ],
    };
  }
}
