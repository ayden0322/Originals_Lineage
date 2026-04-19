import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLineInviteSettingsDto {
  @ApiPropertyOptional({ description: '是否啟用 LINE 邀請浮窗' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '官方 LINE 好友邀請連結' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  inviteUrl?: string;

  @ApiPropertyOptional({ description: '是否顯示 QR Code' })
  @IsBoolean()
  @IsOptional()
  showQrCode?: boolean;

  @ApiPropertyOptional({ description: '浮窗提示文字（tooltip / 標題）' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  tooltip?: string;
}
