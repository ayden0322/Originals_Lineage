import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ModuleConfigService } from './module-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../permission/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

@ApiTags('Modules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules')
export class ModuleConfigController {
  constructor(private readonly moduleConfigService: ModuleConfigService) {}

  @Get()
  @RequirePermission('platform.modules.manage')
  findAll() {
    return this.moduleConfigService.findAll();
  }

  @Get(':code')
  @RequirePermission('platform.modules.manage')
  findByCode(@Param('code') code: string) {
    return this.moduleConfigService.findByCode(code);
  }

  @Patch(':code')
  @RequirePermission('platform.modules.manage')
  update(@Param('code') code: string, @Body() body: Record<string, unknown>) {
    return this.moduleConfigService.update(code, body);
  }

  @Post(':code/toggle-payment')
  @RequirePermission('platform.modules.manage')
  togglePayment(@Param('code') code: string) {
    return this.moduleConfigService.togglePayment(code);
  }

  @Post(':code/toggle-line')
  @RequirePermission('platform.modules.manage')
  toggleLineBot(@Param('code') code: string) {
    return this.moduleConfigService.toggleLineBot(code);
  }
}
