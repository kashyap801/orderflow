import { Module } from '@nestjs/common';
import { FoundationModule } from '@orderflow/common';

@Module({
  imports: [
    FoundationModule.forRoot({
      mongodbUriKey: 'MONGODB_URI_ORDER',
    }),
  ],
})
export class AppModule {}
