import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  ValidateIf,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 禮包內容頁美編設定 DTO
 */
export class UpdatePackageSettingsDto {
  // ─── Hero 區 ──────────────────────────────────────────────────
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  heroEnabled?: boolean;

  @ApiPropertyOptional({ example: '禮包內容' })
  @IsOptional()
  @IsString()
  heroTitle?: string;

  @ApiPropertyOptional({ example: '用四海銀票，兌換精選禮包' })
  @IsOptional()
  @IsString()
  heroSubtitle?: string;

  @ApiPropertyOptional({ description: 'Hero 背景圖（傳 null 清除）' })
  @IsOptional()
  @ValidateIf((o) => o.heroBgImageUrl !== null)
  @IsString()
  heroBgImageUrl?: string | null;

  @ApiPropertyOptional({ example: 240 })
  @IsOptional()
  @IsNumber()
  heroHeight?: number;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  heroTextColor?: string;

  // ─── 貨幣設定 ──────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '四海銀票', description: '貨幣名稱' })
  @IsOptional()
  @IsString()
  currencyName?: string;

  @ApiPropertyOptional({ description: '貨幣 icon URL（傳 null 清除）' })
  @IsOptional()
  @ValidateIf((o) => o.currencyIconUrl !== null)
  @IsString()
  currencyIconUrl?: string | null;

  @ApiPropertyOptional({ example: '#c4a24e', description: '貨幣文字顏色' })
  @IsOptional()
  @IsString()
  currencyColor?: string;

  // ─── 卡片視覺 ──────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 4, description: '每列卡片數（桌面）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  cardColumns?: number;

  @ApiPropertyOptional({ example: '1:1', description: '圖片比例 (1:1 / 4:3 / 16:9)' })
  @IsOptional()
  @IsString()
  cardImageRatio?: string;

  @ApiPropertyOptional({ example: 12, description: '卡片圓角 (px)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32)
  cardBorderRadius?: number;

  @ApiPropertyOptional({ example: 'transparent', description: '卡片邊框顏色' })
  @IsOptional()
  @IsString()
  cardBorderColor?: string;

  // ─── 主色 ──────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '#c4a24e', description: '頁面主色（按鈕、強調）' })
  @IsOptional()
  @IsString()
  accentColor?: string;
}
