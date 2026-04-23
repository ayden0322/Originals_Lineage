import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsBooleanString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListMembersQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '關鍵字：遊戲帳號 / Email / 顯示名稱 / 角色名' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '血盟名（精確匹配，由下拉選單帶入）' })
  @IsOptional()
  @IsString()
  clanName?: string;

  @ApiPropertyOptional({ description: '帳號狀態：true=啟用, false=停用' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @ApiPropertyOptional({ description: '註冊時間起（ISO string）' })
  @IsOptional()
  @IsDateString()
  registeredFrom?: string;

  @ApiPropertyOptional({ description: '註冊時間迄（ISO string）' })
  @IsOptional()
  @IsDateString()
  registeredTo?: string;
}
