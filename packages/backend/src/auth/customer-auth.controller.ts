import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';
import {
  customerLoginSchema,
  customerRegisterSchema,
} from './customer-auth.dto';

@Controller('auth')
export class CustomerAuthController {
  constructor(private readonly customerAuth: CustomerAuthService) {}

  @Post('customer/register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: unknown) {
    const data = customerRegisterSchema.parse(body);
    return this.customerAuth.register(data);
  }

  @Post('customer/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown) {
    const data = customerLoginSchema.parse(body);
    return this.customerAuth.login(data);
  }
}
