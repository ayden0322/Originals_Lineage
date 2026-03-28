import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
}
