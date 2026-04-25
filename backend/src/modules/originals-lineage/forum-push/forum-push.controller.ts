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
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { ForumPushService } from './forum-push.service';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { UpsertRewardConfigDto } from './dto/reward-config.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';
import { StorageService } from '../../../core/storage/storage.service';

// ──────────────────────────────────────────────
// Public endpoints（會員中心）
// ──────────────────────────────────────────────

@ApiTags('Public - Forum Push')
@Controller('public/originals/forum-push')
export class ForumPushPublicController {
  constructor(
    private readonly forumPushService: ForumPushService,
    private readonly storageService: StorageService,
  ) {}

  /** 取得前台狀態：設定、今日剩餘次數、會員遊戲資料、上次填的 FB 資訊 */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: Request) {
    const websiteUserId = (req as any).user?.id;
    return this.forumPushService.getPublicStatus(websiteUserId);
  }

  /** 取得自己所有申請 */
  @Get('my-applications')
  @UseGuards(JwtAuthGuard)
  async myApplications(@Req() req: Request) {
    const websiteUserId = (req as any).user?.id;
    return this.forumPushService.findMyApplications(websiteUserId);
  }

  /** 送出申請 */
  @Post('applications')
  @UseGuards(JwtAuthGuard)
  async submit(@Req() req: Request, @Body() dto: SubmitApplicationDto) {
    const websiteUserId = (req as any).user?.id;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    return this.forumPushService.submit(websiteUserId, dto, ipAddress);
  }

  /** 截圖上傳（已登入會員）→ 存 MinIO，回傳 public URL 供 submit 時帶入 */
  @Post('upload-screenshot')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadScreenshot(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('檔案為必填');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('僅接受圖片檔');
    }
    return this.storageService.upload(file, 'forum-push');
  }
}

// ──────────────────────────────────────────────
// Admin endpoints（模組後台）
// ──────────────────────────────────────────────

@ApiTags('Admin - Forum Push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals/forum-push')
export class ForumPushAdminController {
  constructor(private readonly forumPushService: ForumPushService) {}

  // ─── 申請列表 / 詳情 / 審核 ──────────────────────

  @Get()
  @RequirePermission('module.originals.forum-push.view')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.forumPushService.findAll({
      page: +page,
      limit: +limit,
      status,
      keyword,
      from,
      to,
    });
  }

  @Get(':id')
  @RequirePermission('module.originals.forum-push.view')
  findOne(@Param('id') id: string) {
    return this.forumPushService.findOne(id);
  }

  @Patch(':id/review')
  @RequirePermission('module.originals.forum-push.manage')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
    @Req() req: Request,
  ) {
    const operatorId = (req as any).user?.id;
    return this.forumPushService.review(id, dto, operatorId);
  }

  @Delete(':id')
  @RequirePermission('module.originals.forum-push.manage')
  deleteApplication(@Param('id') id: string) {
    return this.forumPushService.deleteApplication(id);
  }

  // ─── 遊戲道具搜尋（供獎勵道具設定的下拉用） ────

  @Get('config/game-items')
  @RequirePermission('module.originals.settings.manage')
  searchGameItems(
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.forumPushService.searchGameItems(search, +page, +limit);
  }

  // ─── 獎勵道具設定 ──────────────────────────────

  @Get('config/reward-configs')
  @RequirePermission('module.originals.forum-push.view')
  listRewardConfigs() {
    return this.forumPushService.listRewardConfigs();
  }

  @Post('config/reward-configs')
  @RequirePermission('module.originals.settings.manage')
  createRewardConfig(@Body() dto: UpsertRewardConfigDto) {
    return this.forumPushService.createRewardConfig(dto);
  }

  @Patch('config/reward-configs/:id')
  @RequirePermission('module.originals.settings.manage')
  updateRewardConfig(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertRewardConfigDto>,
  ) {
    return this.forumPushService.updateRewardConfig(id, dto);
  }

  @Delete('config/reward-configs/:id')
  @RequirePermission('module.originals.settings.manage')
  deleteRewardConfig(@Param('id') id: string) {
    return this.forumPushService.deleteRewardConfig(id);
  }

  // ─── 全域設定 ──────────────────────────────────

  @Get('config/settings')
  @RequirePermission('module.originals.forum-push.view')
  getSettings() {
    return this.forumPushService.getOrCreateSettings();
  }

  @Patch('config/settings')
  @RequirePermission('module.originals.settings.manage')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.forumPushService.updateSettings(dto);
  }
}
