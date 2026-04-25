import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewItemDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ enum: ['passed', 'rejected'] })
  @IsIn(['passed', 'rejected'])
  result: 'passed' | 'rejected';
}

export class ReviewApplicationDto {
  @ApiProperty({ type: [ReviewItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemDto)
  items: ReviewItemDto[];

  @ApiPropertyOptional({ description: '審核備註 / 未通過原因' })
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
