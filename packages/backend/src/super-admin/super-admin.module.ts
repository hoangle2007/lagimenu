import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocketModule } from '../socket/socket.module';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';

@Module({
  imports: [AuthModule, SocketModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}
