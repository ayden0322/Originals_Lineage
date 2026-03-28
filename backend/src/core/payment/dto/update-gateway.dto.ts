import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGatewayDto {
  @ApiPropertyOptional({ example: '綠界信用卡' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({
    example: { merchantId: '3002607', hashKey: 'xxx', hashIv: 'yyy' },
  })
  @IsObject()
  @IsOptional()
  credentials?: Record<string, unknown>;

  @ApiPropertyOptional({ example: ['credit_card', 'atm', 'cvs'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedMethods?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isSandbox?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  priority?: number;
}
