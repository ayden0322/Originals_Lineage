import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShopManageService } from './shop-manage.service';
import { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';

// ─── Admin Controller ───────────────────────────────────────────────

@ApiTags('Originals - Shop Manage (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals/shop-manage')
export class ShopManageAdminController {
  constructor(private readonly shopManageService: ShopManageService) {}

  @Get('settings')
  @RequirePermission('module.originals.shop.view')
  getSettings() {
    return this.shopManageService.getShopSettings();
  }

  @Put('settings')
  @RequirePermission('module.originals.shop.manage')
  updateSettings(@Body() dto: UpdateShopSettingsDto) {
    return this.shopManageService.updateShopSettings(dto);
  }
}

// ─── Public Controller ──────────────────────────────────────────────

@ApiTags('Originals - Shop (Public)')
@Controller('public/originals/shop')
export class ShopManagePublicController {
  constructor(private readonly shopManageService: ShopManageService) {}

  @Get('config')
  getPublicConfig() {
    return this.shopManageService.getPublicShopConfig();
  }
}
