import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGatewayDto {
  @ApiProperty({ example: 'originals-lineage' })
  @IsString()
  moduleCode: string;

  @ApiProperty({ example: 'ecpay' })
  @IsString()
  providerCode: string;

  @ApiProperty({ example: '綠界信用卡' })
  @IsString()
  displayName: string;

  @ApiProperty({
    example: { merchantId: '3002607', hashKey: 'xxx', hashIv: 'yyy' },
  })
  @IsObject()
  credentials: Record<string, unknown>;

  @ApiPropertyOptional({ example: ['credit_card', 'atm', 'cvs'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedMethods?: string[];

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isSandbox?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @IsOptional()
  priority?: number;
}
