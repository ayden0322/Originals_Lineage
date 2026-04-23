import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';
import { AgentService } from './services/agent.service';
import { RateService } from './services/rate.service';
import { ReferralLinkService } from './services/referral-link.service';
import { AttributionService } from './services/attribution.service';
import { SettlementService } from './services/settlement.service';
import { RefundService } from './services/refund.service';
import { CommissionSettingsService } from './services/commission-settings.service';
import {
  CreateAgentDto,
  UpdateAgentDto,
  ResetAgentPasswordDto,
  UpdateAgentRateDto,
  ChangeAgentParentDto,
  PromoteAgentDto,
  CreateReferralLinkDto,
  ToggleReferralLinkDto,
  ChangeAttributionDto,
  AddAdjustmentDto,
  ApplyRefundDto,
  UpdateSettingDto,
} from './dto/admin-commission.dto';

/**
 * 總後台 API：代理分潤管理
 *
 * 路徑：/modules/originals/commission/*
 * 權限：
 *   - 查看：module.originals.commission.view
 *   - 操作：module.originals.commission.manage
 */
@ApiTags('Admin - Commission')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals/commission')
export class AdminCommissionController {
  constructor(
    private readonly agentService: AgentService,
    private readonly rateService: RateService,
    private readonly linkService: ReferralLinkService,
    private readonly attribution: AttributionService,
    private readonly settlement: SettlementService,
    private readonly refund: RefundService,
    private readonly settings: CommissionSettingsService,
  ) {}

  // ──────────── 代理 ────────────

  @Get('agents/tree')
  @RequirePermission('module.originals.commission.view')
  getTree() {
    return this.agentService.getTree();
  }

  @Get('agents/:id')
  @RequirePermission('module.originals.commission.view')
  async getAgent(@Param('id') id: string) {
    const agent = await this.agentService.findOneOrFail(id);
    const currentRate = await this.rateService.getCurrentRate(id);
    return { ...agent, currentRate };
  }

  @Post('agents')
  @RequirePermission('module.originals.commission.manage')
  async createAgent(@Body() dto: CreateAgentDto, @Req() req: Request) {
    const agent = await this.agentService.create({
      ...dto,
      operatorId: this.getOperatorId(req),
    });
    // save() 回傳物件仍帶有 passwordHash（entity create 時 assign 的），手動排除
    const { passwordHash: _, ...safe } = agent as typeof agent & { passwordHash?: string };
    return safe;
  }

  @Patch('agents/:id')
  @RequirePermission('module.originals.commission.manage')
  updateAgent(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentService.update(id, dto);
  }

  @Patch('agents/:id/rate')
  @RequirePermission('module.originals.commission.manage')
  updateRate(
    @Param('id') id: string,
    @Body() dto: UpdateAgentRateDto,
    @Req() req: Request,
  ) {
    return this.rateService.setRate({
      agentId: id,
      rate: dto.rate,
      operatorId: this.getOperatorId(req),
    });
  }

  @Get('agents/:id/rate-history')
  @RequirePermission('module.originals.commission.view')
  getRateHistory(@Param('id') id: string) {
    return this.rateService.getRateHistory(id);
  }

  @Patch('agents/:id/parent')
  @RequirePermission('module.originals.commission.manage')
  changeParent(
    @Param('id') id: string,
    @Body() dto: ChangeAgentParentDto,
    @Req() req: Request,
  ) {
    return this.agentService.changeParent(
      id,
      dto.newParentId,
      this.getOperatorId(req),
      dto.reason,
    );
  }

  @Post('agents/:id/promote')
  @RequirePermission('module.originals.commission.manage')
  promote(
    @Param('id') id: string,
    @Body() dto: PromoteAgentDto,
    @Req() req: Request,
  ) {
    return this.agentService.promoteToLevel1({
      agentId: id,
      newRate: dto.newRate,
      operatorId: this.getOperatorId(req),
      reason: dto.reason,
    });
  }

  @Get('agents/:id/parent-history')
  @RequirePermission('module.originals.commission.view')
  getParentHistory(@Param('id') id: string) {
    return this.agentService.getParentHistory(id);
  }

  @Post('agents/:id/suspend')
  @RequirePermission('module.originals.commission.manage')
  suspend(@Param('id') id: string) {
    return this.agentService.suspend(id);
  }

  @Post('agents/:id/resume')
  @RequirePermission('module.originals.commission.manage')
  resume(@Param('id') id: string) {
    return this.agentService.resume(id);
  }

  @Patch('agents/:id/password')
  @RequirePermission('module.originals.commission.manage')
  async resetPassword(@Param('id') id: string, @Body() dto: ResetAgentPasswordDto) {
    await this.agentService.resetPassword(id, dto.newPassword);
    return { message: '密碼已重設' };
  }

  // ──────────── 推廣連結 ────────────

  @Get('agents/:id/links')
  @RequirePermission('module.originals.commission.view')
  listLinks(@Param('id') id: string) {
    return this.linkService.listByAgent(id);
  }

  @Post('agents/:id/links')
  @RequirePermission('module.originals.commission.manage')
  createLink(@Param('id') id: string, @Body() dto: CreateReferralLinkDto) {
    return this.linkService.create({ agentId: id, label: dto.label });
  }

  @Patch('links/:id')
  @RequirePermission('module.originals.commission.manage')
  toggleLink(@Param('id') id: string, @Body() dto: ToggleReferralLinkDto) {
    return this.linkService.toggleActive(id, dto.active);
  }

  // ──────────── 玩家歸屬 ────────────

  /**
   * 玩家歸屬總覽（含聚合業績）
   *  - agentId: 篩特定代理旗下
   *  - q: 搜玩家帳號 / email / playerId
   *  - linkedSource: cookie/register/manual/system
   *  - includeSystem: 預設排除 SYSTEM 歸屬（純雜項），=true 時才包含
   */
  @Get('players')
  @RequirePermission('module.originals.commission.view')
  listAttributions(
    @Query('agentId') agentId?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('linkedSource') linkedSource?: 'cookie' | 'register' | 'manual' | 'system',
    @Query('includeSystem') includeSystem?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.attribution.listAttributions({
      agentId: agentId || undefined,
      q: q || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      linkedSource,
      includeSystem: includeSystem === 'true',
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('players/:playerId/attribution')
  @RequirePermission('module.originals.commission.view')
  getAttribution(@Param('playerId') playerId: string) {
    return this.attribution.getAttributionDetail(playerId);
  }

  /**
   * 玩家交易 / 分潤明細（明細頁用）
   *  - from/to ISO 字串；結算週期=日曆月，建議前端傳該月 1 號 00:00 ~ 次月 1 號 00:00
   */
  @Get('players/:playerId/transactions')
  @RequirePermission('module.originals.commission.view')
  listPlayerTransactions(
    @Param('playerId') playerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.attribution.listPlayerTransactions(playerId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Patch('players/:playerId/attribution')
  @RequirePermission('module.originals.commission.manage')
  changeAttribution(
    @Param('playerId') playerId: string,
    @Body() dto: ChangeAttributionDto,
    @Req() req: Request,
  ) {
    return this.attribution.changeAttribution({
      playerId,
      toAgentId: dto.toAgentId,
      operatorId: this.getOperatorId(req),
      reason: dto.reason,
    });
  }

  // ──────────── 結算 ────────────

  /**
   * 當期預估（尚未結算的分潤聚合，只讀）
   * - 不寫入任何資料
   * - 回傳所有 settlement_id IS NULL 的 commission_records 按 (period, agent) 分組
   * - 讓管理者在結算日前就能看到代理本期大概分多少
   */
  @Get('settlements/preview')
  @RequirePermission('module.originals.commission.view')
  previewUnsettled() {
    return this.settlement.getUnsettledPreview();
  }

  /**
   * 血盟儲值統計
   * - period_key 不傳 → 回傳最新一期（連同 availablePeriods 供前端下拉）
   * - 血盟歸屬以 commission_records.clan_id / clan_name 的 snapshot 為準
   */
  @Get('settlements/clan-stats')
  @RequirePermission('module.originals.commission.view')
  getClanStats(@Query('periodKey') periodKey?: string) {
    return this.settlement.getClanStats({ periodKey: periodKey || undefined });
  }

  /**
   * 單一血盟的儲值明細（drill-down）
   * - clanId='none' → 無血盟 (SQL clan_id IS NULL)
   * - 其他 → 以 integer 帶入查詢
   */
  @Get('settlements/clan-stats/records')
  @RequirePermission('module.originals.commission.view')
  getClanRecords(
    @Query('periodKey') periodKey: string,
    @Query('clanId') clanId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!periodKey || !clanId) {
      return { periodKey: periodKey || '', clanId: null, clanName: null, total: 0, items: [] };
    }
    const parsedClanId = clanId === 'none' ? null : Number(clanId);
    return this.settlement.getClanRecords({
      periodKey,
      clanId: Number.isNaN(parsedClanId as number) ? null : parsedClanId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('settlements')
  @RequirePermission('module.originals.commission.view')
  listSettlements(@Query('agentId') agentId?: string) {
    if (!agentId) return [];
    return this.settlement.listByAgent(agentId);
  }

  /**
   * 某代理在某期的訂單明細（含分潤記錄 + 加減項 + 可選期別）
   * - 放在 /settlements/:id 之前，避免 Nest 把 'records' 當成 :id
   * - 無論當期或歷史皆可用
   */
  @Get('settlements/records')
  @RequirePermission('module.originals.commission.view')
  getAgentRecords(
    @Query('agentId') agentId: string,
    @Query('periodKey') periodKey: string,
  ) {
    if (!agentId || !periodKey) {
      return {
        periodKey: periodKey || '',
        availablePeriods: [],
        records: [],
        adjustments: [],
        summary: {
          recordCount: 0,
          totalBaseAmount: 0,
          totalCommission: 0,
          totalAdjustment: 0,
          netCommission: 0,
        },
      };
    }
    return this.settlement.getAgentRecordsByPeriod({ agentId, periodKey });
  }

  @Get('settlements/:id')
  @RequirePermission('module.originals.commission.view')
  getSettlementDetail(@Param('id') id: string) {
    return this.settlement.getDetail(id);
  }

  @Post('settlements/:id/adjustments')
  @RequirePermission('module.originals.commission.manage')
  addAdjustment(
    @Param('id') id: string,
    @Body() dto: AddAdjustmentDto,
    @Req() req: Request,
  ) {
    return this.settlement.addAdjustment({
      settlementId: id,
      amount: dto.amount,
      reason: dto.reason,
      sourceType: dto.sourceType,
      operatorId: this.getOperatorId(req),
    });
  }

  @Post('settlements/:id/confirm')
  @RequirePermission('module.originals.commission.manage')
  confirmSettlement(@Param('id') id: string, @Req() req: Request) {
    return this.settlement.confirm(id, this.getOperatorId(req)!);
  }

  @Post('settlements/:id/mark-paid')
  @RequirePermission('module.originals.commission.manage')
  markPaid(@Param('id') id: string, @Req() req: Request) {
    return this.settlement.markPaid(id, this.getOperatorId(req)!);
  }

  // ──────────── 退款沖銷 ────────────

  @Post('refunds')
  @RequirePermission('module.originals.commission.manage')
  applyRefund(@Body() dto: ApplyRefundDto, @Req() req: Request) {
    return this.refund.applyRefund({
      transactionId: dto.transactionId,
      operatorId: this.getOperatorId(req),
      reason: dto.reason,
    });
  }

  // ──────────── 系統設定 ────────────

  @Get('settings')
  @RequirePermission('module.originals.commission.view')
  getSettings() {
    return this.settings.getAll();
  }

  @Patch('settings')
  @RequirePermission('module.originals.commission.manage')
  updateSetting(@Body() dto: UpdateSettingDto, @Req() req: Request) {
    return this.settings.set(dto.key, dto.value, this.getOperatorId(req));
  }

  // ──────────── 工具 ────────────

  private getOperatorId(req: Request): string | undefined {
    const user = (req as unknown as { user?: { id?: string; sub?: string } }).user;
    return user?.id ?? user?.sub;
  }
}
