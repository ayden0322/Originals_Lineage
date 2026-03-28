import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateReservationStatusDto {
  @ApiProperty({
    enum: ['registered', 'confirmed', 'converted'],
    example: 'confirmed',
  })
  @IsEnum(['registered', 'confirmed', 'converted'])
  status: 'registered' | 'confirmed' | 'converted';
}
