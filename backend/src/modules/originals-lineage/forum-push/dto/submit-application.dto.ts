import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitItemDto {
  @ApiProperty({ enum: ['link', 'screenshot'] })
  @IsIn(['link', 'screenshot'])
  type: 'link' | 'screenshot';

  @ApiProperty({ description: 'link: 推文 URL；screenshot: 上傳後的公開 URL' })
  @IsString()
  @MaxLength(2000)
  content: string;
}

export class SubmitApplicationDto {
  @ApiProperty({ description: '遊戲角色名稱（可選）' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  gameCharacter?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  fbName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  fbLink: string;

  @ApiProperty({ type: [SubmitItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitItemDto)
  items: SubmitItemDto[];
}
