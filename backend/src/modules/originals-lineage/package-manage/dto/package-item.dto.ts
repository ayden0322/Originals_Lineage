import { IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PackageItemDto {
  @ApiProperty({ example: '勇敢藥水' })
  @IsString()
  name: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: '持續時間 30 分鐘' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'http://.../item.png' })
  @IsOptional()
  @IsString()
  iconUrl?: string;
}
