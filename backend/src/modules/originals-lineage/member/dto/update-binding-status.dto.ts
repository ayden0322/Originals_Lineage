import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBindingStatusDto {
  @ApiProperty({ enum: ['pending', 'verified', 'unbound'] })
  @IsEnum(['pending', 'verified', 'unbound'])
  bindingStatus: 'pending' | 'verified' | 'unbound';
}
