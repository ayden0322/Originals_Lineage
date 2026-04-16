import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ReserveService } from './reserve.service';
import { UpdatePageSettingsDto } from './dto/update-page-settings.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';

// ──────────────────────────────────────────────
// Public endpoints
// ──────────────────────────────────────────────

@ApiTags('Public - Reservations')
@Controller('public/originals/reserve')
export class ReservePublicController {
  constructor(private readonly reserveService: ReserveService) {}

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
    const websiteUserId = (req as any).user?.sub;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    return this.reserveService.create(websiteUserId, ipAddress);
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
  constructor(private readonly reserveService: ReserveService) {}

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

  @Patch('milestones/:id')
  @RequirePermission('module.originals.settings.manage')
  updateMilestone(
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.reserveService.updateMilestone(id, dto);
  }

  @Delete('milestones/:id')
  @RequirePermission('module.originals.settings.manage')
  deleteMilestone(@Param('id') id: string) {
    return this.reserveService.deleteMilestone(id);
  }
}
