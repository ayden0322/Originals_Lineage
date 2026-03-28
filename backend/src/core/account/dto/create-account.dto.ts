import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BackendLevel } from '../entities/account.entity';

export class CreateAccountDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '大白' })
  @IsString()
  displayName: string;

  @ApiProperty({ enum: BackendLevel, default: BackendLevel.MODULE })
  @IsEnum(BackendLevel)
  @IsOptional()
  backendLevel?: BackendLevel;
}
