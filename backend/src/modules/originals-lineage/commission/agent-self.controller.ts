import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AgentJwtGuard } from './guards/agent-jwt.guard';
import { AgentAuthService } from './services/agent-auth.service';
import { AgentService } from './services/agent.service';
import { RateService } from './services/rate.service';
import { ReferralLinkService } from './services/referral-link.service';
import { SettlementService } from './services/settlement.service';
import { AgentReportService } from './services/agent-report.service';
import { CommissionSettingsService } from './services/commission-settings.service';
import {
  AgentLoginDto,
  AgentSetSubRateDto,
  AgentCreateLinkDto,
  AgentToggleLinkDto,
} from './dto/agent.dto';

/**
 * 代理自助 API
 *
 * 路徑：/agent/commission/*
 * 認證：AgentJwtGuard（JWT type === 'agent'）
 * 唯一公開端點：POST /agent/commission/auth/login
 */
@ApiTags('Agent - Commission')
@Controller('agent/commission')
export class AgentSelfController {
  constructor(
    private readonly auth: AgentAuthService,
    private readonly agentService: AgentService,
    private readonly rateService: RateService,
    private readonly linkService: ReferralLinkService,
    private readonly settlement: SettlementService,
    private readonly report: AgentReportService,
    private readonly settings: CommissionSettingsService,
  ) {}

  // ──────────── 公開：登入 ────────────

  @Post('auth/login')
  login(@Body() dto: AgentLoginDto) {
    return this.auth.login(dto.loginAccount, dto.password);
  }

  // ──────────── 自己的資訊 ────────────

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const me = this.getMe(req);
    const agent = await this.agentService.findOneOrFail(me.id);
    const currentRate = await this.rateService.getCurrentRate(me.id);
    return {
      id: agent.id,
      code: agent.code,
      name: agent.name,
      parentId: agent.parentId,
      level: agent.parentId ? 2 : 1,
      status: agent.status,
      canSetSubRate: agent.canSetSubRate,
      currentRate,
    };
  }

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Get('me/rate-history')
  rateHistory(@Req() req: Request) {
    return this.rateService.getRateHistory(this.getMe(req).id);
  }

  // ──────────── 推廣連結 ────────────

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Get('me/links')
  myLinks(@Req() req: Request) {
    return this.linkService.listByAgent(this.getMe(req).id);
  }

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Post('me/links')
  createLink(@Req() req: Request, @Body() dto: AgentCreateLinkDto) {
    return this.linkService.create({
      agentId: this.getMe(req).id,
      label: dto.label,
    });
  }

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Patch('me/links/:id')
  async toggleLink(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AgentToggleLinkDto,
  ) {
    // 驗證連結屬於自己
    const myLinks = await this.linkService.listByAgent(this.getMe(req).id);
    if (!myLinks.some((l) => l.id === id)) {
      throw new ForbiddenException('該連結不屬於你');
    }
    return this.linkService.toggleActive(id, dto.active);
  }

  // ──────────── 子代理（A 限定） ────────────

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Get('me/subordinates')
  subordinates(@Req() req: Request) {
    return this.report.getSubordinatesReport(this.getMe(req).id);
  }

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Patch('me/subordinates/:id/rate')
  async setSubRate(
    @Req() req: Request,
    @Param('id') subId: string,
    @Body() dto: AgentSetSubRateDto,
  ) {
    const me = await this.agentService.findOneOrFail(this.getMe(req).id);
    if (me.parentId) {
      throw new ForbiddenException('B 不可調整他人比例');
    }
    if (!me.canSetSubRate) {
      throw new ForbiddenException('管理者未開放你調整子代理比例');
    }
    const sub = await this.agentService.findOneOrFail(subId);
    if (sub.parentId !== me.id) {
      throw new ForbiddenException('該代理不在你旗下');
    }
    // 檢查是否超過系統設定的子代理比例上限
    const maxSubRate = await this.settings.get<number>('max_sub_rate', 1.0);
    if (dto.rate > maxSubRate) {
      throw new ForbiddenException(
        `子代理比例不可超過 ${(maxSubRate * 100).toFixed(0)}%（系統上限）`,
      );
    }
    return this.rateService.setRate({
      agentId: subId,
      rate: dto.rate,
      operatorId: me.id,
    });
  }

  // ──────────── 報表 ────────────

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Get('me/current-period')
  currentPeriod(@Req() req: Request) {
    return this.report.getCurrentPeriodSummary(this.getMe(req).id);
  }

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Get('me/settlements')
  mySettlements(@Req() req: Request) {
    return this.settlement.listByAgent(this.getMe(req).id);
  }

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Get('me/settlements/:id')
  async settlementDetail(@Req() req: Request, @Param('id') id: string) {
    const detail = await this.settlement.getDetail(id);
    if (detail.settlement.agentId !== this.getMe(req).id) {
      throw new ForbiddenException();
    }
    return detail;
  }

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Get('me/settlements/:id/export')
  async exportSettlement(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const csv = await this.report.exportSettlementCsv(this.getMe(req).id, id);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="settlement_${id}.csv"`,
    });
    res.send('\uFEFF' + csv); // BOM for Excel
  }

  @ApiBearerAuth()
  @UseGuards(AgentJwtGuard)
  @Get('me/players')
  myPlayers(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.report.getPlayerTransactions(this.getMe(req).id, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // ──────────── 工具 ────────────

  private getMe(req: Request): { id: string; code: string } {
    const user = (req as unknown as { user?: { id: string; code: string; type?: string } })
      .user;
    if (!user || user.type !== 'agent') {
      throw new BadRequestException('無效的代理身份');
    }
    return { id: user.id, code: user.code };
  }
}
