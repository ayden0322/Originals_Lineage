import {
  IsInt,
  IsOptional,
  IsIn,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxApplicationsPerDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxItemsPerApplication?: number;

  @ApiPropertyOptional({ enum: ['warn', 'block'] })
  @IsOptional()
  @IsIn(['warn', 'block'])
  duplicateUrlPolicy?: 'warn' | 'block';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pageDescription?: string;
}
