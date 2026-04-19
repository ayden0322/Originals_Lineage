import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';
import { SettingsService } from './settings.service';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { UpdateLineBotSettingsDto } from './dto/update-line-bot-settings.dto';
import { UpdateLineInviteSettingsDto } from './dto/update-line-invite-settings.dto';
import { UpdateGameDbSettingsDto } from './dto/update-game-db-settings.dto';
import { TestGameDbConnectionDto } from './dto/test-game-db-connection.dto';
import { UpdateGameTableMappingDto } from './dto/update-game-table-mapping.dto';
import { FetchTableColumnsDto } from './dto/fetch-table-columns.dto';

@ApiTags('Originals Lineage - Settings')
@ApiBearerAuth()
@Controller('modules/originals/settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermission('module.originals.settings.manage')
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put('payment')
  @RequirePermission('module.originals.settings.manage')
  updatePayment(@Body() dto: UpdatePaymentSettingsDto) {
    return this.settingsService.updatePaymentSettings(dto);
  }

  @Put('line-bot')
  @RequirePermission('module.originals.settings.manage')
  updateLineBot(@Body() dto: UpdateLineBotSettingsDto) {
    return this.settingsService.updateLineBotSettings(dto);
  }

  @Put('line-invite')
  @RequirePermission('module.originals.settings.manage')
  updateLineInvite(@Body() dto: UpdateLineInviteSettingsDto) {
    return this.settingsService.updateLineInviteSettings(dto);
  }

  @Put('game-db')
  @RequirePermission('module.originals.settings.manage')
  updateGameDb(@Body() dto: UpdateGameDbSettingsDto) {
    return this.settingsService.updateGameDbSettings(dto);
  }

  @Post('game-db/test')
  @RequirePermission('module.originals.settings.manage')
  testGameDbConnection(@Body() dto: TestGameDbConnectionDto) {
    return this.settingsService.testGameDbConnection(dto);
  }

  @Put('game-table-mapping')
  @RequirePermission('module.originals.settings.manage')
  updateGameTableMapping(@Body() dto: UpdateGameTableMappingDto) {
    return this.settingsService.updateGameTableMapping(dto);
  }

  @Post('game-db/columns')
  @RequirePermission('module.originals.settings.manage')
  fetchTableColumns(@Body() dto: FetchTableColumnsDto) {
    return this.settingsService.fetchTableColumns(dto);
  }
}

// ─── Public Controller ──────────────────────────────────────────────

@ApiTags('Originals Lineage - Settings (Public)')
@Controller('public/originals/line-invite')
export class LineInvitePublicController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get() {
    return this.settingsService.getPublicLineInvite();
  }
}
