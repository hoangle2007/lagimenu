import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { EmployeeLoginService } from './employee-login.service';
import { employeeLoginSchema } from './employee-login.dto';

@Controller('auth')
export class EmployeeLoginController {
  constructor(private employeeLoginService: EmployeeLoginService) {}

  @Post('employee-login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown) {
    const data = employeeLoginSchema.parse(body);
    return this.employeeLoginService.login(data);
  }
}
