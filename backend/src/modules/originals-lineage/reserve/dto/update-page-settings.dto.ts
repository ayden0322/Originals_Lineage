import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePageSettingsDto {
  @ApiPropertyOptional({ example: '事前預約活動' })
  @IsOptional()
  @IsString()
  pageTitle?: string;

  @ApiPropertyOptional({ example: '搶先預約，獲得獨家獎勵！' })
  @IsOptional()
  @IsString()
  pageSubtitle?: string;

  @ApiPropertyOptional({ example: '<p>活動說明...</p>' })
  @IsOptional()
  @IsString()
  pageDescription?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  countBase?: number;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  deadlineAt?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDistributionLocked?: boolean;
}
