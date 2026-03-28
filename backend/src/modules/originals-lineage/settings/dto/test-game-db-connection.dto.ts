import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestGameDbConnectionDto {
  @ApiProperty({ example: '127.0.0.1' })
  @IsString()
  host: string;

  @ApiPropertyOptional({ example: 3306, default: 3306 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiProperty({ example: 'lineage_db' })
  @IsString()
  database: string;

  @ApiProperty({ example: 'root' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
