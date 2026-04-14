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
  UpdateAgentRateDto,
  ChangeAgentParentDto,
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
  createAgent(@Body() dto: CreateAgentDto, @Req() req: Request) {
    return this.agentService.create({
      ...dto,
      operatorId: this.getOperatorId(req),
    });
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
  changeParent(@Param('id') id: string, @Body() dto: ChangeAgentParentDto) {
    return this.agentService.changeParent(id, dto.newParentId);
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

  @Get('players/:playerId/attribution')
  @RequirePermission('module.originals.commission.view')
  getAttribution(@Param('playerId') playerId: string) {
    return this.attribution.getAttribution(playerId);
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

  @Get('settlements')
  @RequirePermission('module.originals.commission.view')
  listSettlements(@Query('agentId') agentId?: string) {
    if (!agentId) return [];
    return this.settlement.listByAgent(agentId);
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
