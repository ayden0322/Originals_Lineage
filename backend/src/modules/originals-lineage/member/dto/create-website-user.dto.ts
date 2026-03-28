import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWebsiteUserDto {
  @ApiProperty({ example: 'my_game_account', description: '遊戲帳號' })
  @IsString()
  @MinLength(4)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: '遊戲帳號只能包含英文、數字和底線',
  })
  gameAccountName: string;

  @ApiProperty({ example: 'secret123', minLength: 6, description: '遊戲密碼（官網密碼自動同步）' })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @ApiProperty({
    example: 'second123',
    minLength: 6,
    description: '第二組密碼',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  secondPassword: string;
}
