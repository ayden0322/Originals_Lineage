import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional({ example: 'ecpay' })
  @IsString()
  @IsOptional()
  providerName?: string;

  @ApiPropertyOptional({ example: 'merchant-id-123' })
  @IsString()
  @IsOptional()
  merchantId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hashKey?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hashIv?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  sandboxMode?: boolean;
}
