import { IsString, IsNumber, IsOptional, IsBoolean, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentLoginDto {
  @ApiProperty({ example: 'agent_a01' })
  @IsString()
  loginAccount: string;

  @ApiProperty({ example: 'P@ssw0rd' })
  @IsString()
  password: string;
}

export class AgentSetSubRateDto {
  @ApiProperty({ example: 0.6 })
  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number;
}

export class AgentCreateLinkDto {
  @IsOptional() @IsString() label?: string;
}

export class AgentToggleLinkDto {
  @IsBoolean() active: boolean;
}
