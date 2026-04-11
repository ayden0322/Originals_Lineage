import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 商城美編設定 DTO
 *
 * 全部欄位皆為 optional，前端可逐欄位 patch。
 * 欲清除某欄位（如背景圖）可傳 null。
 */
export class UpdateShopSettingsDto {
  // ─── Hero 區 ──────────────────────────────────────────────────
  @ApiPropertyOptional({ default: true, description: '是否顯示 Hero 區' })
  @IsOptional()
  @IsBoolean()
  heroEnabled?: boolean;

  @ApiPropertyOptional({ example: '始祖商城', description: 'Hero 標題' })
  @IsOptional()
  @IsString()
  heroTitle?: string;

  @ApiPropertyOptional({
    example: '選購超值商品，開啟您的冒險之旅',
    description: 'Hero 副標題',
  })
  @IsOptional()
  @IsString()
  heroSubtitle?: string;

  @ApiPropertyOptional({ description: 'Hero 背景圖 URL（傳 null 表示清除）' })
  @IsOptional()
  @ValidateIf((o) => o.heroBgImageUrl !== null)
  @IsString()
  heroBgImageUrl?: string | null;

  @ApiPropertyOptional({ example: 240, description: 'Hero 區高度 (px)' })
  @IsOptional()
  @IsNumber()
  heroHeight?: number;

  @ApiPropertyOptional({ example: '#ffffff', description: 'Hero 文字顏色' })
  @IsOptional()
  @IsString()
  heroTextColor?: string;
}
