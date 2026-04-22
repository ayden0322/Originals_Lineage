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

  @ApiPropertyOptional({ example: ['atm', 'cvs'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedMethods?: string[];

  @ApiPropertyOptional({ example: 'smilepay', enum: ['smilepay', 'ecpay', 'antpay', 'tx2', 'tw92', 'mock'] })
  @IsString()
  @IsOptional()
  vendorType?: 'smilepay' | 'ecpay' | 'antpay' | 'tx2' | 'tw92' | 'mock';

  @ApiPropertyOptional({ example: '遊戲點數' })
  @IsString()
  @IsOptional()
  productName?: string;

  @ApiPropertyOptional({ example: 0, description: '單筆最小金額，0=不限制' })
  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @ApiPropertyOptional({ example: 0, description: '開單間隔（分鐘），0=不限制' })
  @IsNumber()
  @IsOptional()
  orderInterval?: number;

  @ApiPropertyOptional({
    example: { name: true, phone: true, email: false },
    description: '實名制欄位開關',
  })
  @IsObject()
  @IsOptional()
  realNameSettings?: Record<string, boolean>;

  @ApiPropertyOptional({
    description: '通道級別設定（ATM / 超商）',
  })
  @IsObject()
  @IsOptional()
  channelSettings?: Record<string, unknown>;

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
