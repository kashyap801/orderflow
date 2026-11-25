import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { FoundationModule } from '@orderflow/common';
import { AuthContextService } from './auth/auth-context';
import { JwtAuthMiddleware } from './auth/jwt-auth.middleware';
import { GatewayController } from './gateway.controller';
import { ProxyMiddleware } from './proxy/proxy.middleware';

@Module({
  imports: [
    FoundationModule.forRoot({
      enableMongo: false,
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'orderflow-dev-secret-change-me'),
      }),
    }),
  ],
  controllers: [GatewayController],
  providers: [ProxyMiddleware, AuthContextService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Auth must run first: the proxy handles the request and never calls next().
    consumer.apply(JwtAuthMiddleware, ProxyMiddleware).forRoutes('*');
  }
}
