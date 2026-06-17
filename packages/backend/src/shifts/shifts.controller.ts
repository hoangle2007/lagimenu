import {
  Controller,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ShiftsService } from './shifts.service';
import { updateShiftSchema } from './shifts.dto';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Put(':id')
  @Roles('merchant', 'EMPLOYEE')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const data = updateShiftSchema.parse(body);
    return this.shiftsService.update(Number(id), data);
  }

  @Delete(':id')
  @Roles('merchant')
  async delete(@Param('id') id: string) {
    return this.shiftsService.delete(Number(id));
  }
}
