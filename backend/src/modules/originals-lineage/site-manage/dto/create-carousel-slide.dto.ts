import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCarouselSlideDto {
  @ApiProperty({ example: 'image', enum: ['image', 'video'] })
  @IsString()
  @IsIn(['image', 'video'])
  mediaType: 'image' | 'video';

  @ApiPropertyOptional({
    example: 'http://localhost:9000/originals-uploads/hero/bg.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    example:
      'https://vod.plaync.com/LineageW/Introduction/2_1_monarch.mp4',
  })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ default: 6, description: '自動輪播秒數' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  autoPlaySeconds?: number;

  @ApiPropertyOptional({ default: false, description: '啟用點擊連結' })
  @IsOptional()
  @IsBoolean()
  linkEnabled?: boolean;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
