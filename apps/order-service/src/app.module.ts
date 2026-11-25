import { Module } from '@nestjs/common';
import { FoundationModule } from '@orderflow/common';
import { HttpInventoryClient, INVENTORY_CLIENT } from './orders/inventory-client';
import { ORDER_MODEL, orderModelFactory } from './orders/order.schema';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';

@Module({
  imports: [
    FoundationModule.forRoot({
      mongodbUriKey: 'MONGODB_URI_ORDER',
    }),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    { provide: ORDER_MODEL, useFactory: orderModelFactory },
    { provide: INVENTORY_CLIENT, useClass: HttpInventoryClient },
  ],
})
export class AppModule {}
