import { Controller, Get, Param } from '@nestjs/common';
import { MenuService } from './menu.service';

@Controller('public')
export class PublicMenuController {
  constructor(private readonly menuService: MenuService) {}

  /** GET /api/public/menu/:merchantId — Public menu for customers */
  @Get('menu/:merchantId')
  async getPublicMenu(@Param('merchantId') merchantId: string) {
    return this.menuService.buildPublicMenuResponse(merchantId);
  }
}
