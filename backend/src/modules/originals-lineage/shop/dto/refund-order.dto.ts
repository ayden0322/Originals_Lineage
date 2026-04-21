import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefundOrderDto {
  @ApiPropertyOptional({
    example: '玩家申請退款，已通過審核',
    description: '退款原因（選填，會一併記在 settlement_adjustments.reason）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
