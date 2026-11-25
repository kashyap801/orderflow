import { Module } from '@nestjs/common';
import { FoundationModule } from '@orderflow/common';
import { PRODUCT_MODEL, productModelFactory } from './products/product.schema';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';

@Module({
  imports: [
    FoundationModule.forRoot({
      mongodbUriKey: 'MONGODB_URI_INVENTORY',
    }),
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    {
      provide: PRODUCT_MODEL,
      useFactory: productModelFactory,
    },
  ],
})
export class AppModule {}
