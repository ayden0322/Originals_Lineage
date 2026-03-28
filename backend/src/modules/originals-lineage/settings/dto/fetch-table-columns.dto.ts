import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const SAFE_IDENTIFIER = /^[\w\u4e00-\u9fff]+$/;

export class FetchTableColumnsDto {
  @ApiProperty({
    example: 'accounts',
    description: '要讀取欄位的資料表名稱',
  })
  @IsString()
  @Matches(SAFE_IDENTIFIER, {
    message: 'Table name contains invalid characters',
  })
  tableName: string;
}
