import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BindGameAccountDto {
  @ApiProperty({ example: 'my_game_account' })
  @IsString()
  gameAccountName: string;
}
