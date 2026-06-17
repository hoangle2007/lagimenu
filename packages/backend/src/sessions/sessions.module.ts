import { Module } from '@nestjs/common';
import { PublicSessionController } from './public-session.controller';

import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [MerchantsModule],
  controllers: [PublicSessionController],
})
export class SessionsModule {}
