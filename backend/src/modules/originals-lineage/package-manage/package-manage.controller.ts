import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PackageManageService } from './package-manage.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { UpdatePackageSettingsDto } from './dto/update-package-settings.dto';
import { ReorderPackagesDto } from './dto/reorder.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';

// ─── Admin ──────────────────────────────────────────────────────────

@ApiTags('Originals - Package Manage (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals/package-manage')
export class PackageManageAdminController {
  constructor(private readonly svc: PackageManageService) {}

  // ── Packages ──
  @Get('packages')
  @RequirePermission('module.originals.shop.view')
  findAll() {
    return this.svc.findAll();
  }

  @Post('packages')
  @RequirePermission('module.originals.shop.manage')
  create(@Body() dto: CreatePackageDto) {
    return this.svc.create(dto);
  }

  @Patch('packages/:id')
  @RequirePermission('module.originals.shop.manage')
  update(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.svc.update(id, dto);
  }

  @Delete('packages/:id')
  @RequirePermission('module.originals.shop.manage')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Put('packages/reorder')
  @RequirePermission('module.originals.shop.manage')
  reorder(@Body() dto: ReorderPackagesDto) {
    return this.svc.reorder(dto);
  }

  // ── Settings ──
  @Get('settings')
  @RequirePermission('module.originals.shop.view')
  getSettings() {
    return this.svc.getSettings();
  }

  @Put('settings')
  @RequirePermission('module.originals.shop.manage')
  updateSettings(@Body() dto: UpdatePackageSettingsDto) {
    return this.svc.updateSettings(dto);
  }
}

// ─── Public ─────────────────────────────────────────────────────────

@ApiTags('Originals - Packages (Public)')
@Controller('public/originals/packages')
export class PackageManagePublicController {
  constructor(private readonly svc: PackageManageService) {}

  @Get('config')
  getPublicConfig() {
    return this.svc.getPublicConfig();
  }
}
