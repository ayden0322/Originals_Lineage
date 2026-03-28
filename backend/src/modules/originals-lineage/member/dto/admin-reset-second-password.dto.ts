import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminResetSecondPasswordDto {
  @ApiProperty({ description: '新的第二組密碼', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  newSecondPassword: string;
}
