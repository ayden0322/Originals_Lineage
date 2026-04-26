import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class NotifyGroupDto {
  @ApiPropertyOptional()
  @IsString()
  groupId: string;

  @ApiPropertyOptional()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: "目前支援 'recharge'" })
  @IsArray()
  @IsString({ each: true })
  @IsIn(['recharge'], { each: true })
  events: string[];
}

export class UpdateLineBotSettingsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  channelId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  channelSecret?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  channelAccessToken?: string;

  @ApiPropertyOptional({ description: '儲值通知總開關' })
  @IsBoolean()
  @IsOptional()
  rechargeNotifyEnabled?: boolean;

  @ApiPropertyOptional({ type: [NotifyGroupDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => NotifyGroupDto)
  notifyGroups?: NotifyGroupDto[];
}
