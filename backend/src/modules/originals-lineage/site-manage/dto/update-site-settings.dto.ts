import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsUUID,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSiteSettingsDto {
  @ApiPropertyOptional({ example: '始祖天堂' })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional({ example: '無盡傳奇再啟', description: '網站副標語（顯示在瀏覽器分頁標題）' })
  @IsOptional()
  @IsString()
  siteSlogan?: string;

  @ApiPropertyOptional({ example: '跨越時光，重返懷念的世界。事前預約、最新消息、線上商城一次掌握。', description: '網站描述（SEO meta description）' })
  @IsOptional()
  @IsString()
  siteDescription?: string;

  @ApiPropertyOptional({ example: 'http://localhost:9000/originals-uploads/site/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '始祖天堂 © 2026' })
  @IsOptional()
  @IsString()
  footerText?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  heroEnabled?: boolean;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  newsDisplayCount?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  featuredArticleIds?: string[];

  // ─── Nav Style Settings ──────────────────────────────────────
  @ApiPropertyOptional({ example: '#ffffff', description: '導航當前項目文字顏色' })
  @IsOptional()
  @IsString()
  navActiveColor?: string;

  @ApiPropertyOptional({ example: 'rgba(255,255,255,0.3)', description: '導航非當前項目文字顏色' })
  @IsOptional()
  @IsString()
  navInactiveColor?: string;

  @ApiPropertyOptional({ example: 28, description: '導航當前項目字體大小(px)' })
  @IsOptional()
  @IsNumber()
  navActiveFontSize?: number;

  @ApiPropertyOptional({ example: 14, description: '導航非當前項目字體大小(px)' })
  @IsOptional()
  @IsNumber()
  navInactiveFontSize?: number;

  @ApiPropertyOptional({ example: '700', description: '導航當前項目字體粗細' })
  @IsOptional()
  @IsString()
  navActiveFontWeight?: string;

  @ApiPropertyOptional({ example: '400', description: '導航非當前項目字體粗細' })
  @IsOptional()
  @IsString()
  navInactiveFontWeight?: string;

  @ApiPropertyOptional({ example: 2, description: '導航文字字距(px)' })
  @IsOptional()
  @IsNumber()
  navLetterSpacing?: number;

  @ApiPropertyOptional({ example: "'Georgia', serif", description: '導航字體' })
  @IsOptional()
  @IsString()
  navFontFamily?: string;

  // ─── Font & Logo Settings ────────────────────────────────────────
  @ApiPropertyOptional({ example: "'Noto Serif TC', serif", description: '標題字體' })
  @IsOptional()
  @IsString()
  headingFontFamily?: string;

  @ApiPropertyOptional({ example: "'Noto Sans TC', sans-serif", description: '內文字體' })
  @IsOptional()
  @IsString()
  bodyFontFamily?: string;

  @ApiPropertyOptional({ example: 'medium', description: 'Logo 大小 (small/medium/large)' })
  @IsOptional()
  @IsString()
  logoSize?: string;

  // ─── Color Theme Settings ────────────────────────────────────────
  @ApiPropertyOptional({ example: '#c4a24e', description: '主題色' })
  @IsOptional()
  @IsString()
  accentColor?: string;

  @ApiPropertyOptional({ example: '#d4b76a', description: '主題色淺色' })
  @IsOptional()
  @IsString()
  accentColorLight?: string;

  @ApiPropertyOptional({ example: 'rgba(0,0,0,0.85)', description: '選單列背景色' })
  @IsOptional()
  @IsString()
  headerBgColor?: string;

  @ApiPropertyOptional({ example: '#0a0a0a', description: '頁面背景色' })
  @IsOptional()
  @IsString()
  bgPrimary?: string;

  @ApiPropertyOptional({ example: '#111111', description: '區塊背景色' })
  @IsOptional()
  @IsString()
  bgSecondary?: string;

  @ApiPropertyOptional({ example: '#ffffff', description: '主要文字顏色' })
  @IsOptional()
  @IsString()
  textPrimary?: string;

  @ApiPropertyOptional({ example: 'rgba(255,255,255,0.7)', description: '次要文字顏色' })
  @IsOptional()
  @IsString()
  textSecondary?: string;

  @ApiPropertyOptional({ example: '#111111', description: '底部背景色' })
  @IsOptional()
  @IsString()
  footerBgColor?: string;

  @ApiPropertyOptional({ example: 'rgba(255,255,255,0.4)', description: '底部文字顏色' })
  @IsOptional()
  @IsString()
  footerTextColor?: string;

  // ─── BGM Settings ────────────────────────────────────────────
  @ApiPropertyOptional({ description: '全站預設背景音樂 URL（傳 null 表示清除）' })
  @IsOptional()
  @ValidateIf((o) => o.defaultBgm !== null)
  @IsString()
  defaultBgm?: string | null;

  @ApiPropertyOptional({ description: '各頁面背景音樂 (JSON: { path: url })' })
  @IsOptional()
  pageBgm?: Record<string, string | null>;

  @ApiPropertyOptional({ example: 0.3, description: '預設音量 (0~1)' })
  @IsOptional()
  @IsNumber()
  bgmVolume?: number;

  @ApiPropertyOptional({ default: true, description: '是否自動播放' })
  @IsOptional()
  @IsBoolean()
  bgmAutoPlay?: boolean;

  // ─── Font Scale ────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 1.0, description: '全站文字縮放比例 (0.8~1.5)，不影響富文本及輪播標題' })
  @IsOptional()
  @IsNumber()
  fontScale?: number;

  // ─── News Page Settings ────────────────────────────────────────
  @ApiPropertyOptional({ example: 'magazine', description: '新聞頁佈局模式' })
  @IsOptional()
  @IsString()
  newsLayout?: 'magazine' | 'timeline' | 'masonry';

  @ApiPropertyOptional({ example: '最新消息', description: '新聞頁標題' })
  @IsOptional()
  @IsString()
  newsPageTitle?: string;

  @ApiPropertyOptional({ example: '探索始祖天堂的最新動態', description: '新聞頁副標題' })
  @IsOptional()
  @IsString()
  newsPageSubtitle?: string;

  @ApiPropertyOptional({ description: '新聞頁 Banner 圖片 URL' })
  @IsOptional()
  @IsString()
  newsBannerUrl?: string;

  @ApiPropertyOptional({ default: 12, description: '每頁顯示數量' })
  @IsOptional()
  @IsNumber()
  newsPerPage?: number;

  @ApiPropertyOptional({ example: 'newest', description: '預設排序方式' })
  @IsOptional()
  @IsString()
  newsDefaultSort?: 'newest' | 'popular' | 'pinned';

  @ApiPropertyOptional({ default: true, description: '是否顯示封面圖' })
  @IsOptional()
  @IsBoolean()
  newsShowCover?: boolean;

  @ApiPropertyOptional({ default: true, description: '是否顯示瀏覽數' })
  @IsOptional()
  @IsBoolean()
  newsShowViewCount?: boolean;

  @ApiPropertyOptional({ default: true, description: '是否顯示搜尋欄' })
  @IsOptional()
  @IsBoolean()
  newsShowSearch?: boolean;

  // ─── Changelog Page Settings ────────────────────────────────
  @ApiPropertyOptional({ description: '更新歷程 Banner 圖片 URL' })
  @IsOptional()
  @IsString()
  changelogBannerUrl?: string;

  @ApiPropertyOptional({ example: 'updates', description: '更新歷程抓取的文章分類 slug' })
  @IsOptional()
  @IsString()
  changelogCategorySlug?: string;

  @ApiPropertyOptional({ example: '更新歷程', description: '更新歷程頁面標題' })
  @IsOptional()
  @IsString()
  changelogPageTitle?: string;

  @ApiPropertyOptional({ example: '掌握每一次改版的軌跡', description: '更新歷程頁副標題' })
  @IsOptional()
  @IsString()
  changelogPageSubtitle?: string;

  @ApiPropertyOptional({ example: 'timeline', description: '更新歷程頁佈局模式' })
  @IsOptional()
  @IsString()
  changelogLayout?: 'magazine' | 'timeline' | 'masonry';

  @ApiPropertyOptional({ default: 12, description: '每頁顯示數量' })
  @IsOptional()
  @IsNumber()
  changelogPerPage?: number;

  @ApiPropertyOptional({ example: 'newest', description: '預設排序方式' })
  @IsOptional()
  @IsString()
  changelogDefaultSort?: 'newest' | 'popular' | 'pinned';

  @ApiPropertyOptional({ default: true, description: '是否顯示封面圖' })
  @IsOptional()
  @IsBoolean()
  changelogShowCover?: boolean;

  @ApiPropertyOptional({ default: true, description: '是否顯示瀏覽數' })
  @IsOptional()
  @IsBoolean()
  changelogShowViewCount?: boolean;

  @ApiPropertyOptional({ default: false, description: '是否顯示搜尋欄' })
  @IsOptional()
  @IsBoolean()
  changelogShowSearch?: boolean;

  // ─── Support Page Settings ────────────────────────────────
  @ApiPropertyOptional({ example: 'https://line.me/R/ti/p/@xxx', description: '官方 Line 連結' })
  @IsOptional()
  @IsString()
  lineOfficialUrl?: string;

  @ApiPropertyOptional({ example: '掃描 QR Code 加入官方 LINE', description: '官方 Line QR Code 下方說明文字' })
  @IsOptional()
  @IsString()
  lineOfficialCaption?: string;

  @ApiPropertyOptional({ example: 'https://line.me/R/ti/g/xxx', description: '交易群連結' })
  @IsOptional()
  @IsString()
  tradingGroupUrl?: string;

  @ApiPropertyOptional({ example: '掃描 QR Code 加入交易群', description: '交易群 QR Code 下方說明文字' })
  @IsOptional()
  @IsString()
  tradingGroupCaption?: string;

  @ApiPropertyOptional({ example: 'https://drive.google.com/file/xxx', description: '遊戲下載連結' })
  @IsOptional()
  @IsString()
  gameDownloadUrl?: string;

  // ─── Reserve Page Settings ────────────────────────────────
  @ApiPropertyOptional({ description: '啟用新兵報到頁面' })
  @IsOptional()
  @IsBoolean()
  reserveEnabled?: boolean;

  @ApiPropertyOptional({ description: '開服日期（ISO string，倒數計時用）' })
  @IsOptional()
  @IsString()
  reserveLaunchDate?: string;

  @ApiPropertyOptional({ description: '預約頁 Hero Banner 圖片' })
  @IsOptional()
  @IsString()
  reserveBannerUrl?: string;

  @ApiPropertyOptional({ description: '預約頁背景圖' })
  @IsOptional()
  @IsString()
  reserveBgImageUrl?: string;

  @ApiPropertyOptional({ example: '新兵報到', description: '預約頁標題' })
  @IsOptional()
  @IsString()
  reserveTitle?: string;

  @ApiPropertyOptional({ description: '預約頁副標題' })
  @IsOptional()
  @IsString()
  reserveSubtitle?: string;

  @ApiPropertyOptional({ description: '預約頁說明文字' })
  @IsOptional()
  @IsString()
  reserveDescription?: string;

  @ApiPropertyOptional({ example: '立即預約', description: '按鈕文字' })
  @IsOptional()
  @IsString()
  reserveButtonText?: string;

  @ApiPropertyOptional({ description: '預約頁強調色' })
  @IsOptional()
  @IsString()
  reserveAccentColor?: string;

  @ApiPropertyOptional({ description: '啟用里程碑顯示' })
  @IsOptional()
  @IsBoolean()
  reserveMilestonesEnabled?: boolean;

  @ApiPropertyOptional({ description: '啟用 Email 驗證' })
  @IsOptional()
  @IsBoolean()
  reserveEmailVerificationEnabled?: boolean;

  @ApiPropertyOptional({ description: '預約成功自訂訊息' })
  @IsOptional()
  @IsString()
  reserveSuccessMessage?: string;

  @ApiPropertyOptional({ description: '表單欄位配置 JSON' })
  @IsOptional()
  reserveFieldConfig?: Record<string, { visible: boolean; required: boolean }>;
}
