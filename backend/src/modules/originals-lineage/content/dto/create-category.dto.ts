import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: '新聞' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'news' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ example: '#c4a24e' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
