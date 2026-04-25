import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertRewardConfigDto {
  @ApiProperty({ description: '遊戲道具編號' })
  @IsInt()
  @Min(1)
  itemCode: number;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  itemName: string;

  @ApiProperty({ description: '每通過 1 則推文發的數量' })
  @IsInt()
  @Min(1)
  quantityPerPass: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
