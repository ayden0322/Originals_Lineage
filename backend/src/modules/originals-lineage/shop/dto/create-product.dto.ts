import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductCategory {
  DIAMOND_PACK = 'diamond_pack',
  SPECIAL_BUNDLE = 'special_bundle',
  EVENT_PACK = 'event_pack',
}

export class CreateProductDto {
  @ApiProperty({ example: '鑽石禮包 100' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '包含 100 顆鑽石' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsInt()
  diamondAmount: number;

  @ApiProperty({ enum: ProductCategory, example: ProductCategory.DIAMOND_PACK })
  @IsEnum(ProductCategory)
  category: ProductCategory;

  @ApiPropertyOptional({ example: 'https://example.com/diamond-pack.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ default: -1, description: '-1 = unlimited' })
  @IsOptional()
  @IsInt()
  stock?: number = -1;

  @ApiPropertyOptional({ default: 0, description: '0 = unlimited' })
  @IsOptional()
  @IsInt()
  maxPerUser?: number = 0;

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
