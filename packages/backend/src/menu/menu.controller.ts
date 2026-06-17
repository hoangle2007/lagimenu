import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MenuService, type ProductCreateBody, type ProductUpdateBody } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // GET /api/menu/merchant/:merchantId/categories
  @Get('merchant/:merchantId/categories')
  async getCategories(@Param('merchantId') merchantId: string) {
    return this.menuService.getCategories(merchantId);
  }

  // POST /api/menu/merchant/:merchantId/categories
  @UseGuards(JwtAuthGuard)
  @Post('merchant/:merchantId/categories')
  async createCategory(
    @Param('merchantId') merchantId: string,
    @Body() body: { name: string; order?: number },
  ) {
    return this.menuService.createCategory(merchantId, body);
  }

  // PUT /api/menu/merchant/:merchantId/categories/reorder — before :id
  @UseGuards(JwtAuthGuard)
  @Put('merchant/:merchantId/categories/reorder')
  async reorderCategories(
    @Param('merchantId') merchantId: string,
    @Body() body: { orderedIds: number[] },
  ) {
    const ids = Array.isArray(body?.orderedIds)
      ? body.orderedIds.map((n) => Number(n)).filter((n) => !Number.isNaN(n))
      : [];
    await this.menuService.reorderCategories(merchantId, ids);
    return { ok: true };
  }

  // PUT /api/menu/merchant/:merchantId/categories/:id
  @UseGuards(JwtAuthGuard)
  @Put('merchant/:merchantId/categories/:id')
  async updateCategory(
    @Param('merchantId') merchantId: string,
    @Param('id') id: string,
    @Body() body: { name?: string; order?: number },
  ) {
    return this.menuService.updateCategory(merchantId, Number(id), body);
  }

  // DELETE /api/menu/merchant/:merchantId/categories/:id
  @UseGuards(JwtAuthGuard)
  @Delete('merchant/:merchantId/categories/:id')
  async deleteCategory(
    @Param('merchantId') merchantId: string,
    @Param('id') id: string,
  ) {
    await this.menuService.deleteCategory(merchantId, Number(id));
    return { success: true };
  }

  // POST /api/menu/merchant/:merchantId/products
  @UseGuards(JwtAuthGuard)
  @Post('merchant/:merchantId/products')
  async createProduct(
    @Param('merchantId') merchantId: string,
    @Body()
    body: ProductCreateBody,
  ) {
    return this.menuService.createProduct(merchantId, body);
  }

  // PUT /api/menu/merchant/:merchantId/products/:id
  @UseGuards(JwtAuthGuard)
  @Put('merchant/:merchantId/products/:id')
  async updateProduct(
    @Param('merchantId') merchantId: string,
    @Param('id') id: string,
    @Body()
    body: ProductUpdateBody,
  ) {
    return this.menuService.updateProduct(merchantId, Number(id), body);
  }

  /** PATCH bulk-price — must be registered before products/:id */
  @UseGuards(JwtAuthGuard)
  @Patch('merchant/:merchantId/products/bulk-price')
  async bulkPrice(
    @Param('merchantId') merchantId: string,
    @Body() body: { items: { id: number; price: string }[] },
  ) {
    const items = Array.isArray(body?.items) ? body.items : [];
    await this.menuService.bulkUpdateProductPrices(merchantId, items);
    return { ok: true };
  }

  /** PATCH /api/menu/merchant/:merchantId/products/:id */
  @UseGuards(JwtAuthGuard)
  @Patch('merchant/:merchantId/products/:id')
  async patchProduct(
    @Param('merchantId') merchantId: string,
    @Param('id') id: string,
    @Body()
    body: ProductUpdateBody,
  ) {
    return this.menuService.updateProduct(merchantId, Number(id), body);
  }

  // DELETE /api/menu/merchant/:merchantId/products/:id
  @UseGuards(JwtAuthGuard)
  @Delete('merchant/:merchantId/products/:id')
  async deleteProduct(
    @Param('merchantId') merchantId: string,
    @Param('id') id: string,
  ) {
    await this.menuService.deleteProduct(merchantId, Number(id));
    return { success: true };
  }

  /** GET /api/menu/:merchantId — public alias (must stay last; avoid catching `merchant`). */
  @Get(':merchantId')
  async getPublicMenuByMerchantId(@Param('merchantId') merchantId: string) {
    return this.menuService.buildPublicMenuResponse(merchantId);
  }
}
