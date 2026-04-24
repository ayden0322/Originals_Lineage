import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
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

  @ApiPropertyOptional({ description: '官方 LINE QR Code 下方說明文字' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  inviteCaption?: string;

  @ApiPropertyOptional({ description: '官方交易群連結' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  tradingGroupUrl?: string;

  @ApiPropertyOptional({ description: '官方交易群 QR Code 下方說明文字' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  tradingGroupCaption?: string;

  @ApiPropertyOptional({ description: '自訂浮窗圖示 URL，留空則使用內建 LINE 圖示' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  iconUrl?: string;

  @ApiPropertyOptional({ description: '桌面版 FAB 按鈕尺寸（px），範圍 36–96，預設 48' })
  @IsInt()
  @IsOptional()
  @Min(36)
  @Max(96)
  iconSize?: number;

  @ApiPropertyOptional({ description: '手機版 FAB 按鈕尺寸（px），範圍 32–80，預設 44' })
  @IsInt()
  @IsOptional()
  @Min(32)
  @Max(80)
  iconSizeMobile?: number;
}
