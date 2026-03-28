import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AnnouncementType {
  MAINTENANCE = 'maintenance',
  EVENT = 'event',
  NOTICE = 'notice',
  URGENT = 'urgent',
}

export class CreateAnnouncementDto {
  @ApiProperty({ example: '伺服器維護通知' })
  @IsString()
  title: string;

  @ApiProperty({ example: '維護內容說明...' })
  @IsString()
  content: string;

  @ApiProperty({ enum: AnnouncementType, example: AnnouncementType.MAINTENANCE })
  @IsEnum(AnnouncementType)
  type: AnnouncementType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  priority?: number = 0;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiProperty({ example: '2026-03-04T10:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiPropertyOptional({ example: '2026-03-05T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}
