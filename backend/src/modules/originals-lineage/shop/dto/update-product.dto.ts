import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCategory } from './create-product.dto';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: '鑽石禮包 200' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '包含 200 顆鑽石' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  @IsInt()
  diamondAmount?: number;

  @ApiPropertyOptional({ enum: ProductCategory })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiPropertyOptional({ example: 'https://example.com/diamond-pack-v2.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: '-1 = unlimited' })
  @IsOptional()
  @IsInt()
  stock?: number;

  @ApiPropertyOptional({ description: '0 = unlimited' })
  @IsOptional()
  @IsInt()
  maxPerUser?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
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
