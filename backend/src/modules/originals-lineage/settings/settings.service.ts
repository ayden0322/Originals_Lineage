import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleConfigService } from '../../../core/module-config/module-config.service';
import { GameDbService, GameDbConfig } from '../game-db/game-db.service';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { UpdateLineBotSettingsDto } from './dto/update-line-bot-settings.dto';
import { UpdateLineInviteSettingsDto } from './dto/update-line-invite-settings.dto';
import { UpdateGameDbSettingsDto } from './dto/update-game-db-settings.dto';
import { TestGameDbConnectionDto } from './dto/test-game-db-connection.dto';
import { UpdateGameTableMappingDto } from './dto/update-game-table-mapping.dto';
import { FetchTableColumnsDto } from './dto/fetch-table-columns.dto';

const MODULE_CODE = 'originals-lineage';

@Injectable()
export class SettingsService {
  constructor(
    private readonly moduleConfigService: ModuleConfigService,
    private readonly gameDbService: GameDbService,
  ) {}

  async getSettings() {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');
    return {
      moduleCode: config.moduleCode,
      moduleName: config.moduleName,
      isActive: config.isActive,
      paymentEnabled: config.paymentEnabled,
      lineBotEnabled: config.lineBotEnabled,
      payment: config.configJson?.['payment'] || {},
      lineBot: config.configJson?.['lineBot'] || {},
      lineInvite: config.configJson?.['lineInvite'] || {
        enabled: false,
        inviteUrl: '',
        showQrCode: true,
        tooltip: '加入官方 LINE',
        inviteCaption: '官方 LINE',
        tradingGroupUrl: '',
        tradingGroupCaption: '官方交易群',
        iconUrl: '',
        iconSize: 48,
        iconSizeMobile: 44,
      },
      gameDb: config.configJson?.['gameDb'] || {},
      gameDbConnected: this.gameDbService.isConnected,
      gameTableMapping: config.configJson?.['gameTableMapping'] || null,
    };
  }

  async updateLineInviteSettings(dto: UpdateLineInviteSettingsDto) {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');

    const current = (config.configJson?.['lineInvite'] as Record<string, unknown>) || {};
    const lineInvite = { ...current, ...dto };
    const configJson = { ...config.configJson, lineInvite };
    await this.moduleConfigService.update(MODULE_CODE, { configJson });
    return this.getSettings();
  }

  async getPublicLineInvite() {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    const raw = (config?.configJson?.['lineInvite'] as Record<string, unknown>) || {};
    const enabled = Boolean(raw.enabled);
    const inviteUrl = (raw.inviteUrl as string) || '';
    const tradingGroupUrl = (raw.tradingGroupUrl as string) || '';
    // 未啟用，或官方 LINE 與交易群連結都沒填，則不渲染浮窗
    if (!enabled || (!inviteUrl && !tradingGroupUrl)) {
      return {
        enabled: false,
        inviteUrl: '',
        showQrCode: false,
        tooltip: '',
        inviteCaption: '',
        tradingGroupUrl: '',
        tradingGroupCaption: '',
        iconUrl: '',
        iconSize: 48,
        iconSizeMobile: 44,
      };
    }
    const rawIconSize = Number(raw.iconSize);
    const rawIconSizeMobile = Number(raw.iconSizeMobile);
    const iconSize =
      Number.isFinite(rawIconSize) && rawIconSize >= 36 && rawIconSize <= 96
        ? Math.round(rawIconSize)
        : 48;
    const iconSizeMobile =
      Number.isFinite(rawIconSizeMobile) && rawIconSizeMobile >= 32 && rawIconSizeMobile <= 80
        ? Math.round(rawIconSizeMobile)
        : 44;
    return {
      enabled: true,
      inviteUrl,
      showQrCode: raw.showQrCode !== false,
      tooltip: (raw.tooltip as string) || '加入官方 LINE',
      inviteCaption: (raw.inviteCaption as string) || '官方 LINE',
      tradingGroupUrl,
      tradingGroupCaption: (raw.tradingGroupCaption as string) || '官方交易群',
      iconUrl: (raw.iconUrl as string) || '',
      iconSize,
      iconSizeMobile,
    };
  }

  async updatePaymentSettings(dto: UpdatePaymentSettingsDto) {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');

    const configJson = { ...config.configJson, payment: dto };
    await this.moduleConfigService.update(MODULE_CODE, { configJson });
    return this.getSettings();
  }

  async updateLineBotSettings(dto: UpdateLineBotSettingsDto) {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');

    const configJson = { ...config.configJson, lineBot: dto };
    await this.moduleConfigService.update(MODULE_CODE, { configJson });
    return this.getSettings();
  }

  async updateGameDbSettings(dto: UpdateGameDbSettingsDto) {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');

    const gameDbConfig: GameDbConfig = {
      connectionName: dto.connectionName,
      host: dto.host,
      port: dto.port ?? 3306,
      database: dto.database,
      username: dto.username,
      password: dto.password,
    };

    const configJson = { ...config.configJson, gameDb: gameDbConfig };
    await this.moduleConfigService.update(MODULE_CODE, { configJson });

    await this.gameDbService.initializeDataSource(gameDbConfig);

    return this.getSettings();
  }

  async testGameDbConnection(dto: TestGameDbConnectionDto) {
    try {
      const success = await this.gameDbService.testConnection({
        host: dto.host,
        port: dto.port ?? 3306,
        database: dto.database,
        username: dto.username,
        password: dto.password,
      });
      return { success, message: success ? '連線成功' : '連線失敗' };
    } catch (error) {
      return { success: false, message: (error as Error).message || '連線失敗' };
    }
  }

  // ─── Game Table Mapping ──────────────────────────────────

  async updateGameTableMapping(dto: UpdateGameTableMappingDto) {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');

    const gameTableMapping = {
      tableName: dto.tableName,
      columns: {
        username: dto.columns.username,
        password: dto.columns.password,
        email: dto.hasEmailColumn ? dto.columns.email : null,
        status: dto.hasStatusColumn ? dto.columns.status : null,
      },
      passwordEncryption: dto.passwordEncryption,
      hasEmailColumn: dto.hasEmailColumn,
      hasStatusColumn: dto.hasStatusColumn,
    };

    const configJson = { ...config.configJson, gameTableMapping };
    await this.moduleConfigService.update(MODULE_CODE, { configJson });
    return this.getSettings();
  }

  async fetchTableColumns(dto: FetchTableColumnsDto) {
    try {
      const columns = await this.gameDbService.getTableColumns(dto.tableName);
      return { success: true, columns };
    } catch (error) {
      return {
        success: false,
        columns: [],
        message: (error as Error).message || '讀取欄位失敗',
      };
    }
  }
}
