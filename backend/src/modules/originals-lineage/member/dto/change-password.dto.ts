import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: '第二組密碼（用於驗證身份）' })
  @IsString()
  secondPassword: string;

  @ApiProperty({ description: '新密碼', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  newPassword: string;
}
