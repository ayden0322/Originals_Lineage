import {
  Controller,
  Get,
  Param,
  Res,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReferralLinkService } from './services/referral-link.service';
import { CommissionSettingsService } from './services/commission-settings.service';

/**
 * 公開推廣連結追蹤
 *
 * 玩家掃 QR 或點連結 → GET /public/originals/ref/:code
 * 行為：
 *  1. 驗證 code 存在且 active
 *  2. 寫 Cookie ref_code（cookie_days 設定，預設 30 天）
 *  3. 302 導向首頁（或 ?to=xxx 指定目標）
 */
@ApiTags('Public - Referral Tracking')
@Controller('public/originals/ref')
export class PublicReferralController {
  constructor(
    private readonly linkService: ReferralLinkService,
    private readonly settings: CommissionSettingsService,
  ) {}

  @Get(':code')
  async track(
    @Param('code') code: string,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const link = await this.linkService.findByCode(code);

    // 即使 code 無效或停用，也要導向（避免暴露細節），但不寫 Cookie
    const cookieDays = await this.settings.get<number>('cookie_days', 30);
    if (link && link.active) {
      res.cookie('ref_code', code, {
        maxAge: cookieDays * 24 * 60 * 60 * 1000,
        httpOnly: false, // 讓前端 register 時可讀
        sameSite: 'lax',
        // 必須指定 path='/'，否則預設會用請求路徑（/api/public/originals/ref），
        // 導致前端 /auth/register 讀不到 cookie → refCode 永遠 undefined → 歸屬到 SYSTEM
        path: '/',
      });
    }

    const target = this.sanitizeRedirect(to) ?? '/';
    return res.redirect(302, target);
  }

  /** 防 open-redirect：只允許相對路徑 */
  private sanitizeRedirect(to?: string): string | null {
    if (!to) return null;
    if (!to.startsWith('/')) return null;
    if (to.startsWith('//')) return null;
    return to;
  }
}
