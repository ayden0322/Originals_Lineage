import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckGameAccountDto {
  @ApiProperty({ example: 'my_game_account' })
  @IsString()
  @MinLength(4)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: '遊戲帳號只能包含英文、數字和底線',
  })
  gameAccountName: string;
}
