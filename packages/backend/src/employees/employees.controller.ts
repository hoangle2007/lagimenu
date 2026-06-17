import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EmployeesService, toEmployeePublic } from './employees.service';
import { ShiftsService } from '../shifts/shifts.service';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesSchema,
} from './employees.dto';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(
    private employeesService: EmployeesService,
    private shiftsService: ShiftsService,
  ) {}

  @Get()
  @Roles('merchant', 'EMPLOYEE')
  async list(@Request() req: any, @Query() query: unknown) {
    const filter = listEmployeesSchema.parse(query);
    // Override shopId from token to prevent cross-shop access
    filter.shopId = req.user.shopId;
    return this.employeesService.list(filter);
  }

  @Get(':id')
  @Roles('merchant', 'EMPLOYEE')
  async findOne(@Param('id') id: string) {
    const row = await this.employeesService.findById(id);
    return { employee: toEmployeePublic(row) };
  }

  @Post()
  @Roles('merchant')
  async create(@Request() req: any, @Body() body: any) {
    const data = createEmployeeSchema.parse({
      ...body,
      shopId: req.user.shopId,
    });
    const row = await this.employeesService.create(data);
    return { employee: toEmployeePublic(row) };
  }

  @Put(':id')
  @Roles('merchant')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const data = updateEmployeeSchema.parse(body);
    const row = await this.employeesService.update(id, data);
    return { employee: toEmployeePublic(row) };
  }

  @Delete(':id')
  @Roles('merchant')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    return this.employeesService.deactivate(id);
  }

  // ── Shifts ────────────────────────────────────────────────────────────────

  @Get(':id/shifts')
  @Roles('merchant', 'EMPLOYEE')
  async listShifts(@Param('id') id: string) {
    return this.shiftsService.listByEmployee(id);
  }

  @Post(':id/shifts')
  @Roles('merchant')
  async createShift(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = await import('../shifts/shifts.dto').then((m) =>
      m.createShiftSchema.parse(body),
    );
    return this.shiftsService.create(req.user.shopId, {
      ...data,
      employeeId: id,
    });
  }
}
