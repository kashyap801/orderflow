import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { FoundationModule } from '@orderflow/common';
import { AuthContextService } from './auth/auth-context';
import { GatewayController } from './gateway.controller';
import { ProxyMiddleware } from './proxy/proxy.middleware';

@Module({
  imports: [
    FoundationModule.forRoot({
      enableMongo: false,
    }),
  ],
  controllers: [GatewayController],
  providers: [ProxyMiddleware, AuthContextService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ProxyMiddleware).forRoutes('*');
  }
}
