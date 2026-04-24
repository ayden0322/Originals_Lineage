import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  ValidateIf,
  ValidateNested,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** 贊助加碼比值區間（前端顯示用，後端不影響下單數量） */
export class BonusTierDto {
  @ApiPropertyOptional({ example: 5000, description: '金額下限（含）NT$' })
  @IsNumber()
  @Min(0)
  minAmount!: number;

  @ApiPropertyOptional({ example: 1.1, description: '倍率（1 代表不加碼）' })
  @IsNumber()
  @Min(0)
  ratio!: number;
}

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

  // ─── 貨幣顯示 ────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '四海銀票', description: '貨幣名稱' })
  @IsOptional()
  @IsString()
  currencyName?: string;

  @ApiPropertyOptional({ description: '貨幣 Icon URL（傳 null 表示清除）' })
  @IsOptional()
  @ValidateIf((o) => o.currencyIconUrl !== null)
  @IsString()
  currencyIconUrl?: string | null;

  @ApiPropertyOptional({ example: '#c4a24e', description: '貨幣顏色' })
  @IsOptional()
  @IsString()
  currencyColor?: string;

  // ─── 主色 ────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '#c4a24e', description: '主色（Tag / 強調色）' })
  @IsOptional()
  @IsString()
  accentColor?: string;

  // ─── 贊助加碼比值 ────────────────────────────────────────────
  @ApiPropertyOptional({
    type: [BonusTierDto],
    description: '贊助加碼比值（前端顯示用，後端不影響下單數量）',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BonusTierDto)
  bonusTiers?: BonusTierDto[];
}
