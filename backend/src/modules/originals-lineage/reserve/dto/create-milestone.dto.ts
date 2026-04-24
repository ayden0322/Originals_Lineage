import { IsInt, IsString, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMilestoneDto {
  @ApiProperty({ example: 1000 })
  @IsInt()
  threshold: number;

  @ApiProperty({ example: '限定坐騎' })
  @IsString()
  rewardName: string;

  @ApiPropertyOptional({ example: '<p>達標即可獲得限定坐騎一匹</p>' })
  @IsOptional()
  @IsString()
  rewardDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 綁定遊戲道具 etcitem.item_id，未綁不可發放 */
  @ApiPropertyOptional({ example: 60000001 })
  @IsOptional()
  @IsInt()
  gameItemId?: number;

  /** 綁定時的道具名稱快照（淨化顏色碼後） */
  @ApiPropertyOptional({ example: '事前預約-第一階段獎勵' })
  @IsOptional()
  @IsString()
  gameItemName?: string;

  /** 每人發放數量，預設 1 */
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  gameItemQuantity?: number;
}
