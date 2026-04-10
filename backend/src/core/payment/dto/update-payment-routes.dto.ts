import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentRouteItemDto {
  @ApiProperty({ enum: ['atm', 'cvs'], example: 'atm' })
  @IsString()
  @IsIn(['atm', 'cvs'])
  paymentMethod: 'atm' | 'cvs';

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
    description: 'gateway id；null 表示「無」（停用該付款方式）',
  })
  @IsOptional()
  @IsUUID()
  gatewayId: string | null;
}

export class UpdatePaymentRoutesDto {
  @ApiProperty({ type: [PaymentRouteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentRouteItemDto)
  routes: PaymentRouteItemDto[];
}
