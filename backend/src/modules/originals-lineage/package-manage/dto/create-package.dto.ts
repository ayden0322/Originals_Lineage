import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackageItemDto } from './package-item.dto';

export class CreatePackageDto {
  @ApiProperty({ example: '新手成長禮包' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '開服限定，數量有限' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '卡片縮圖 URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Modal 展示大圖 URL' })
  @IsOptional()
  @IsString()
  largeImageUrl?: string;

  @ApiProperty({ example: 100, description: '兌換所需貨幣數量' })
  @IsInt()
  @Min(0)
  currencyAmount: number;

  @ApiPropertyOptional({ type: [PackageItemDto], description: '禮包內容物列表（舊資料相容用）' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageItemDto)
  items?: PackageItemDto[];

  @ApiPropertyOptional({ description: '禮包內容富文本（HTML）' })
  @IsOptional()
  @IsString()
  contentHtml?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
