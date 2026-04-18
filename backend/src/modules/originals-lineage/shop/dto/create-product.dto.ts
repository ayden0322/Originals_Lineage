import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsIn,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 商品類別
 *
 * 歷史上支援 'diamond' | 'game_item' | 'monthly_card'，
 * 自 2026-04 起僅開放 'diamond'（以台幣兌換四海銀票），
 * 其他類別保留型別以相容資料庫既有資料，但不接受新建/修改為該類別。
 */
export const PRODUCT_CATEGORIES = ['diamond', 'game_item', 'monthly_card'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** 目前允許建立的類別（僅 diamond） */
export const ACTIVE_PRODUCT_CATEGORIES = ['diamond'] as const;

export class CreateProductDto {
  @ApiProperty({ example: '鑽石禮包 100' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '包含 100 顆鑽石' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 30, description: '商品價格（NT$），至少 1' })
  @IsNumber()
  @Min(1)
  price: number;

  @ApiProperty({ enum: ACTIVE_PRODUCT_CATEGORIES, example: 'diamond' })
  @IsIn(ACTIVE_PRODUCT_CATEGORIES as unknown as string[], {
    message: '目前僅支援 diamond（四海銀票）類別',
  })
  category: ProductCategory;

  // ─── 鑽石類專用 ────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 100, description: '鑽石類必填，發放鑽石數量' })
  @ValidateIf((o) => o.category === 'diamond')
  @IsInt()
  @Min(1)
  diamondAmount?: number;

  // ─── 遊戲禮包/月卡類專用 ──────────────────────────────────────
  @ApiPropertyOptional({ example: 6000121, description: '遊戲禮包/月卡必填，etcitem.item_id' })
  @ValidateIf((o) => o.category === 'game_item' || o.category === 'monthly_card')
  @IsInt()
  @Min(6000001)
  gameItemId?: number;

  @ApiPropertyOptional({ example: '命名大師算命所' })
  @ValidateIf((o) => o.category === 'game_item' || o.category === 'monthly_card')
  @IsString()
  gameItemName?: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: '每次發放數量' })
  @IsOptional()
  @IsInt()
  @Min(1)
  gameItemQuantity?: number;

  // ─── 通用 ────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'https://example.com/img.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ default: -1, description: '-1 = unlimited' })
  @IsOptional()
  @IsInt()
  stock?: number;

  @ApiPropertyOptional({ default: 0, description: '帳號總購買上限，0 = 不限' })
  @IsOptional()
  @IsInt()
  @Min(0)
  accountLimit?: number;

  @ApiPropertyOptional({ description: '每日購買上限' })
  @IsOptional()
  @IsInt()
  @Min(1)
  dailyLimit?: number | null;

  @ApiPropertyOptional({ description: '每週購買上限' })
  @IsOptional()
  @IsInt()
  @Min(1)
  weeklyLimit?: number | null;

  @ApiPropertyOptional({ description: '每週重置星期 0=週日 ~ 6=週六' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weeklyResetDay?: number | null;

  @ApiPropertyOptional({ description: '每週重置時點 0~23' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  weeklyResetHour?: number | null;

  @ApiPropertyOptional({ description: '每月購買上限' })
  @IsOptional()
  @IsInt()
  @Min(1)
  monthlyLimit?: number | null;

  @ApiPropertyOptional({ description: '角色最低等級限制' })
  @IsOptional()
  @IsInt()
  @Min(1)
  requiredLevel?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}
