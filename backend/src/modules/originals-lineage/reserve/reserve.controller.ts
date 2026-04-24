import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ReserveService } from './reserve.service';
import { RewardClaimService } from './reward-claim.service';
import { MilestoneValidationService } from './milestone-validation.service';
import { GameDbService } from '../game-db/game-db.service';
import { UpdatePageSettingsDto } from './dto/update-page-settings.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { MarkClaimStatusDto } from './dto/mark-claim-status.dto';
import type { RewardClaimStatus } from './entities/reward-claim.entity';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';

// ──────────────────────────────────────────────
// Public endpoints
// ──────────────────────────────────────────────

@ApiTags('Public - Reservations')
@Controller('public/originals/reserve')
export class ReservePublicController {
  constructor(
    private readonly reserveService: ReserveService,
    private readonly claimService: RewardClaimService,
  ) {}

  /**
   * 取得預約頁狀態（人數、里程碑、頁面設定、我是否已預約）
   * 未登入也能看，只是 myReservation.reserved 永遠為 false
   */
  @Get('status')
  async getStatus(@Req() req: Request) {
    // 嘗試從 Authorization header 取得 user id（可選，不強制登入）
    const websiteUserId = this.extractUserIdFromToken(req);
    return this.reserveService.getPublicStatus(websiteUserId);
  }

  /**
   * 建立預約（必須登入 + 已綁定遊戲帳號）
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: Request) {
    const websiteUserId = (req as any).user?.id;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    return this.reserveService.create(websiteUserId, ipAddress);
  }

  /**
   * 取得目前使用者的獎勵清單
   */
  @Get('my-rewards')
  @UseGuards(JwtAuthGuard)
  async myRewards(@Req() req: Request) {
    const websiteUserId = (req as any).user?.id;
    return this.claimService.findMyClaims(websiteUserId);
  }

  // ─── Private helper: 從 token 取 userId（不拋錯）────────────────

  private extractUserIdFromToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return undefined;

    try {
      const token = authHeader.substring(7);
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      );
      return payload.sub;
    } catch {
      return undefined;
    }
  }
}

// ──────────────────────────────────────────────
// Admin endpoints (JWT + Permission guards)
// ──────────────────────────────────────────────

@ApiTags('Admin - Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals/reservations')
export class ReserveAdminController {
  constructor(
    private readonly reserveService: ReserveService,
    private readonly claimService: RewardClaimService,
    private readonly validation: MilestoneValidationService,
    private readonly gameDbService: GameDbService,
  ) {}

  // ─── 預約管理 ──────────────────────────────────────────────────

  @Get()
  @RequirePermission('module.originals.reserve.view')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('keyword') keyword?: string,
  ) {
    return this.reserveService.findAll(+page, +limit, keyword);
  }

  @Get('stats')
  @RequirePermission('module.originals.reserve.view')
  getStats() {
    return this.reserveService.getStats();
  }

  @Post('export')
  @RequirePermission('module.originals.reserve.manage')
  async exportCsv(@Res() res: Response) {
    const csv = await this.reserveService.exportCsv();

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reservations.csv"',
    });
    res.send(csv);
  }

  // ─── 頁面設定 ──────────────────────────────────────────────────

  @Get('page-settings')
  @RequirePermission('module.originals.settings.manage')
  getPageSettings() {
    return this.reserveService.getPageSettings();
  }

  @Patch('page-settings')
  @RequirePermission('module.originals.settings.manage')
  updatePageSettings(@Body() dto: UpdatePageSettingsDto) {
    return this.reserveService.updatePageSettings(dto);
  }

  // ─── 里程碑管理 ────────────────────────────────────────────────

  @Get('milestones')
  @RequirePermission('module.originals.settings.manage')
  findAllMilestones() {
    return this.reserveService.findAllMilestones();
  }

  @Post('milestones')
  @RequirePermission('module.originals.settings.manage')
  createMilestone(@Body() dto: CreateMilestoneDto) {
    return this.reserveService.createMilestone(dto);
  }

  /**
   * 更新里程碑。若變更影響 game_item_id / reward_name / game_item_name：
   *   - 先檢查 editability：若已有 sent/processing claim → 擋下
   *   - 更新成功後，若 rewardName / gameItemName 有變 → 同步更新 pending/failed claim 的 snapshot
   */
  @Patch('milestones/:id')
  @RequirePermission('module.originals.settings.manage')
  async updateMilestone(
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    const current = await this.reserveService.findMilestoneById(id);
    const itemBindingChanging =
      dto.gameItemId !== undefined && dto.gameItemId !== current.gameItemId;
    const rewardNameChanging =
      (dto.rewardName !== undefined && dto.rewardName !== current.rewardName) ||
      (dto.gameItemName !== undefined &&
        dto.gameItemName !== current.gameItemName);

    if (itemBindingChanging) {
      const editability = await this.claimService.getEditabilityForMilestone(id);
      if (!editability.canEdit) {
        throw new BadRequestException({
          message: editability.reason ?? '此里程碑目前不可變更道具',
          editability,
        });
      }
    }

    const updated = await this.reserveService.updateMilestone(id, dto);

    if (rewardNameChanging) {
      await this.claimService.syncPendingSnapshotsAfterMilestoneEdit(
        id,
        updated.rewardName,
      );
    }

    return updated;
  }

  @Delete('milestones/:id')
  @RequirePermission('module.originals.settings.manage')
  deleteMilestone(@Param('id') id: string) {
    return this.reserveService.deleteMilestone(id);
  }

  /**
   * 查詢某里程碑目前是否可編輯「綁定道具」。
   * 前端在「綁定道具」區塊旁顯示狀態提示。
   */
  @Get('milestones/:id/editability')
  @RequirePermission('module.originals.settings.manage')
  getMilestoneEditability(@Param('id') id: string) {
    return this.claimService.getEditabilityForMilestone(id);
  }

  /**
   * 遊戲道具挑選器：供里程碑綁定時從 etcitem 模糊搜尋
   * （等同 shop/game-items，但走 reserve 權限）
   */
  @Get('game-items')
  @RequirePermission('module.originals.settings.manage')
  findGameItems(
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.gameDbService.findGameItems(search, +page, +limit);
  }

  // ─── 發獎批次 ─────────────────────────────────────────────────

  /**
   * [舊] 單純建立 pending claim 不觸發寄送。保留供遷移期使用。
   * 新流程請用 start-distribution。
   */
  @Post('milestones/:id/distribute')
  @RequirePermission('module.originals.reserve.manage')
  distributeMilestone(@Param('id') id: string) {
    return this.claimService.distributeMilestone(id);
  }

  /**
   * 發放前驗證：顯示里程碑是否可發放、缺什麼條件。
   * 前端「開始發放」Modal 按「確認」前先呼叫此端點做最後把關與預覽。
   */
  @Get('milestones/:id/validate')
  @RequirePermission('module.originals.reserve.manage')
  validateMilestoneForDistribution(@Param('id') id: string) {
    return this.validation.validateCanDistribute(id);
  }

  /**
   * 開始單一里程碑的發放（走驗證 → 建 claim → 背景寄送）。
   * HTTP 立即回應，實際寄送在背景進行。
   */
  @Post('milestones/:id/start-distribution')
  @RequirePermission('module.originals.reserve.manage')
  startDistribution(@Param('id') id: string, @Req() req: Request) {
    const operatorId = (req as any).user?.id ?? null;
    return this.claimService.startDistribution(id, operatorId);
  }

  /**
   * 一鍵發放所有「已達標且綁定道具」的里程碑。
   * 不走逐筆 validate（listReady 已篩過），若個別里程碑啟動失敗會記錄在回傳內。
   */
  @Post('distribute-all-reached')
  @RequirePermission('module.originals.reserve.manage')
  distributeAllReached(@Req() req: Request) {
    const operatorId = (req as any).user?.id ?? null;
    return this.claimService.startDistributionForAllReached(operatorId);
  }

  /**
   * 發放總覽：各里程碑的 pending / sent / failed 人數
   */
  @Get('distributions')
  @RequirePermission('module.originals.reserve.view')
  getDistributionSummary() {
    return this.claimService.getDistributionSummary();
  }

  /**
   * 查詢某里程碑底下的 claim 清單
   */
  @Get('milestones/:id/claims')
  @RequirePermission('module.originals.reserve.view')
  findClaimsByMilestone(
    @Param('id') id: string,
    @Query('status') status?: RewardClaimStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.claimService.findClaimsByMilestone(id, status, +page, +limit);
  }

  /**
   * 批次更新 claim 狀態（人工寄完信後標 sent）
   */
  @Patch('claims/status')
  @RequirePermission('module.originals.reserve.manage')
  markClaimsStatus(@Body() dto: MarkClaimStatusDto, @Req() req: Request) {
    const operatorId = (req as any).user?.id;
    return this.claimService.markClaimsStatus(
      dto.claimIds,
      dto.status,
      operatorId,
      dto.note,
    );
  }
}
