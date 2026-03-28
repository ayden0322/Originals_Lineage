import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeSecondPasswordDto {
  @ApiProperty({ description: '遊戲密碼（驗證身份）', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @ApiProperty({ description: '當前第二組密碼', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  currentSecondPassword: string;

  @ApiProperty({ description: '新的第二組密碼', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  newSecondPassword: string;
}
