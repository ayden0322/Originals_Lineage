import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  ValidateNested,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// 只允許英數、底線、中文字元，防止 SQL injection
const SAFE_IDENTIFIER = /^[\w\u4e00-\u9fff]+$/;

export enum PasswordEncryption {
  PLAINTEXT = 'plaintext',
  MD5 = 'md5',
  SHA1 = 'sha1',
  SHA256 = 'sha256',
  BCRYPT = 'bcrypt',
}

export class ColumnMappingDto {
  @ApiProperty({ example: 'login', description: '帳號欄位名稱' })
  @IsString()
  @Matches(SAFE_IDENTIFIER, {
    message: 'username column name contains invalid characters',
  })
  username: string;

  @ApiProperty({ example: 'password', description: '密碼欄位名稱' })
  @IsString()
  @Matches(SAFE_IDENTIFIER, {
    message: 'password column name contains invalid characters',
  })
  password: string;

  @ApiPropertyOptional({
    example: 'email',
    description: 'Email 欄位名稱，null 表示無此欄位',
  })
  @IsString()
  @IsOptional()
  @Matches(SAFE_IDENTIFIER, {
    message: 'email column name contains invalid characters',
  })
  email?: string | null;

  @ApiPropertyOptional({
    example: 'banned',
    description: '狀態欄位名稱，null 表示無此欄位',
  })
  @IsString()
  @IsOptional()
  @Matches(SAFE_IDENTIFIER, {
    message: 'status column name contains invalid characters',
  })
  status?: string | null;
}

export class UpdateGameTableMappingDto {
  @ApiProperty({ example: 'accounts', description: '資料表名稱' })
  @IsString()
  @Matches(SAFE_IDENTIFIER, {
    message: 'Table name contains invalid characters',
  })
  tableName: string;

  @ApiProperty({ type: ColumnMappingDto })
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  columns: ColumnMappingDto;

  @ApiProperty({ enum: PasswordEncryption, example: 'plaintext' })
  @IsEnum(PasswordEncryption)
  passwordEncryption: PasswordEncryption;

  @ApiProperty({ example: false })
  @IsBoolean()
  hasEmailColumn: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  hasStatusColumn: boolean;
}
