import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { FoundationModule } from '@orderflow/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { USER_MODEL, userModelFactory } from './auth/user.schema';
import { OrderEventPublisher } from './events/order-event-publisher';
import { HttpInventoryClient, INVENTORY_CLIENT } from './orders/inventory-client';
import { ORDER_MODEL, orderModelFactory } from './orders/order.schema';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';

@Module({
  imports: [
    FoundationModule.forRoot({
      mongodbUriKey: 'MONGODB_URI_ORDER',
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'orderflow-dev-secret-change-me'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') },
      }),
    }),
  ],
  controllers: [AuthController, OrdersController],
  providers: [
    AuthService,
    OrdersService,
    OrderEventPublisher,
    { provide: USER_MODEL, useFactory: userModelFactory },
    { provide: ORDER_MODEL, useFactory: orderModelFactory },
    { provide: INVENTORY_CLIENT, useClass: HttpInventoryClient },
  ],
})
export class AppModule {}
