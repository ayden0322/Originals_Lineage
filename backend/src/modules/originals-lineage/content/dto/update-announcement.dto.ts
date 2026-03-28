import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementType } from './create-announcement.dto';

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ example: '更新後的標題' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '更新後的內容...' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: AnnouncementType })
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-03-04T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ example: '2026-03-05T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}
