import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShopService } from './shop.service';
import { PaymentRouteService } from '../../../core/payment/payment-route.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  CreateProductTemplateDto,
  UpdateProductTemplateDto,
} from './dto/product-template.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// ─── Admin Controller ─────────────────────────────────────────────────

@ApiTags('Originals - Shop (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals')
export class ShopAdminController {
  constructor(private readonly shopService: ShopService) {}

  // ─── Products ───────────────────────────────────────────────────────

  @Post('products')
  @RequirePermission('module.originals.shop.manage')
  createProduct(@Body() dto: CreateProductDto) {
    return this.shopService.createProduct(dto);
  }

  @Get('products')
  @RequirePermission('module.originals.shop.view')
  findAllProducts(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('category') category?: string,
  ) {
    return this.shopService.findAllProducts(+page, +limit, category);
  }

  @Get('products/:id')
  @RequirePermission('module.originals.shop.view')
  findProductById(@Param('id') id: string) {
    return this.shopService.findProductById(id);
  }

  @Patch('products/:id')
  @RequirePermission('module.originals.shop.manage')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.shopService.updateProduct(id, dto);
  }

  @Post('products/:id/move')
  @RequirePermission('module.originals.shop.manage')
  moveProduct(
    @Param('id') id: string,
    @Body('direction') direction: 'up' | 'down',
  ) {
    return this.shopService.moveProduct(id, direction);
  }

  @Delete('products/:id')
  @RequirePermission('module.originals.shop.manage')
  deleteProduct(@Param('id') id: string) {
    return this.shopService.deleteProduct(id);
  }

  // ─── Game Items（遊戲物品挑選器） ───────────────────────────────────

  @Get('shop/game-items')
  @RequirePermission('module.originals.shop.manage')
  findGameItems(
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.shopService.findGameItems(search, +page, +limit);
  }

  // ─── Product Templates（常用範本） ─────────────────────────────────

  @Post('shop/templates')
  @RequirePermission('module.originals.shop.manage')
  createTemplate(
    @Body() dto: CreateProductTemplateDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.shopService.createTemplate(dto, userId);
  }

  @Get('shop/templates')
  @RequirePermission('module.originals.shop.manage')
  findAllTemplates(@Query('category') category?: string) {
    return this.shopService.findAllTemplates(category);
  }

  @Patch('shop/templates/:id')
  @RequirePermission('module.originals.shop.manage')
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateProductTemplateDto,
  ) {
    return this.shopService.updateTemplate(id, dto);
  }

  @Delete('shop/templates/:id')
  @RequirePermission('module.originals.shop.manage')
  deleteTemplate(@Param('id') id: string) {
    return this.shopService.deleteTemplate(id);
  }

  // ─── Orders ─────────────────────────────────────────────────────────

  @Get('orders')
  @RequirePermission('module.originals.orders.view')
  findAllOrders(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.shopService.findAllOrders(+page, +limit);
  }

  @Get('orders/:id')
  @RequirePermission('module.originals.orders.view')
  findOrderById(@Param('id') id: string) {
    return this.shopService.findAdminOrderById(id);
  }

  @Post('orders/:id/retry-delivery')
  @RequirePermission('module.originals.orders.manage')
  retryDelivery(@Param('id') id: string) {
    return this.shopService.retryDelivery(id);
  }

  /**
   * 一鍵退款：改訂單狀態 → 沖銷分潤（同一個動作）
   * - 僅允許 status='paid' 的訂單
   * - 冪等：訂單已 refunded 會回 409
   */
  @Post('orders/:id/refund')
  @RequirePermission('module.originals.orders.manage')
  refundOrder(
    @Param('id') id: string,
    @Body() dto: RefundOrderDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.shopService.refundOrder({
      orderId: id,
      reason: dto.reason,
      operatorId,
    });
  }
}

// ─── Public Controller ────────────────────────────────────────────────

@ApiTags('Originals - Shop (Public)')
@Controller('public/originals/shop')
export class ShopPublicController {
  constructor(
    private readonly shopService: ShopService,
    private readonly paymentRouteService: PaymentRouteService,
  ) {}

  @Get('products')
  findActiveProducts() {
    return this.shopService.findActiveProducts();
  }

  /**
   * 取得本模組目前對玩家公開的可用付款方式（已綁 active gateway 的）
   * 用於商城購買 Modal 顯示付款方式選單
   */
  @Get('payment-methods')
  findAvailablePaymentMethods() {
    return this.paymentRouteService.findAvailableMethodsForPublic('originals-lineage');
  }

  @Post('orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createOrder(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.shopService.createOrder(userId, dto);
  }

  @Get('orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findMyOrders(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.shopService.findOrdersByUserId(userId, +page, +limit);
  }
}
