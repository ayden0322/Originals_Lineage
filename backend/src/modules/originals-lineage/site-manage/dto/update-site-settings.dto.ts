import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsUUID,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSiteSettingsDto {
  @ApiPropertyOptional({ example: '始祖天堂' })
  @IsOptional()
  @IsString()
  siteName?: string;

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

  // ─── Support Page Settings ────────────────────────────────
  @ApiPropertyOptional({ example: 'https://line.me/R/ti/p/@xxx', description: '官方 Line 連結' })
  @IsOptional()
  @IsString()
  lineOfficialUrl?: string;

  @ApiPropertyOptional({ example: 'https://drive.google.com/file/xxx', description: '遊戲下載連結' })
  @IsOptional()
  @IsString()
  gameDownloadUrl?: string;
}
