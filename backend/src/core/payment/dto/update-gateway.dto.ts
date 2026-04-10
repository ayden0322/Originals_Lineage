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

  @ApiPropertyOptional({ example: ['atm', 'cvs'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedMethods?: string[];

  @ApiPropertyOptional({ enum: ['smilepay', 'ecpay', 'antpay', 'tx2', 'mock'] })
  @IsString()
  @IsOptional()
  vendorType?: 'smilepay' | 'ecpay' | 'antpay' | 'tx2' | 'mock';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  productName?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  orderInterval?: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  realNameSettings?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  channelSettings?: Record<string, unknown>;

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
