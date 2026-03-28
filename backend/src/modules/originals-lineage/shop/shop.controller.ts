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
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOrderDto } from './dto/create-order.dto';
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
  ) {
    return this.shopService.findAllProducts(+page, +limit);
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

  @Delete('products/:id')
  @RequirePermission('module.originals.shop.manage')
  deleteProduct(@Param('id') id: string) {
    return this.shopService.deleteProduct(id);
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
    return this.shopService.findOrderById(id);
  }

  @Post('orders/:id/retry-delivery')
  @RequirePermission('module.originals.orders.manage')
  retryDelivery(@Param('id') id: string) {
    return this.shopService.retryDelivery(id);
  }
}

// ─── Public Controller ────────────────────────────────────────────────

@ApiTags('Originals - Shop (Public)')
@Controller('public/originals/shop')
export class ShopPublicController {
  constructor(private readonly shopService: ShopService) {}

  @Get('products')
  findActiveProducts() {
    return this.shopService.findActiveProducts();
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
    // Look up member binding to get memberBindingId
    return this.shopService.findOrdersByUserId(userId, +page, +limit);
  }
}
