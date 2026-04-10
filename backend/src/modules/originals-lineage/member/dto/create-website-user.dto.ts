import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWebsiteUserDto {
  @ApiProperty({ example: 'mygame01', description: '遊戲帳號（4-13 字元）' })
  @IsString()
  @MinLength(4, { message: '遊戲帳號至少 4 個字元' })
  @MaxLength(13, { message: '遊戲帳號最多 13 個字元（受遊戲資料庫限制）' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: '遊戲帳號只能包含英文、數字和底線',
  })
  gameAccountName: string;

  @ApiProperty({
    example: 'secret123',
    description: '遊戲密碼（既有玩家：輸入目前遊戲密碼以驗證身份；新玩家：至少 6 碼，將同步為官網密碼）',
  })
  @IsString()
  @MinLength(1)
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
