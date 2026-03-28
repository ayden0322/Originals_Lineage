import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @RequirePermission('platform.permissions.manage')
  findAll() {
    return this.permissionService.findAll();
  }

  @Get('categories')
  @RequirePermission('platform.permissions.manage')
  getGrouped() {
    return this.permissionService.getGroupedPermissions();
  }

  @Get('by-account/:id')
  @RequirePermission('platform.permissions.manage')
  findByAccount(@Param('id') accountId: string) {
    return this.permissionService.findByAccount(accountId);
  }

  @Post('assign')
  @RequirePermission('platform.permissions.manage')
  assign(
    @Body() body: { accountId: string; permissionCodes: string[] },
    @CurrentUser() user: { id: string },
  ) {
    return this.permissionService.assignPermissions(
      body.accountId,
      body.permissionCodes,
      user.id,
    );
  }

  @Delete('revoke')
  @RequirePermission('platform.permissions.manage')
  revoke(@Body() body: { accountId: string; permissionCodes: string[] }) {
    return this.permissionService.revokePermissions(
      body.accountId,
      body.permissionCodes,
    );
  }
}
