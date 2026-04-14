import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsIn,
  Min,
  Max,
  MinLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─────────── 代理 ───────────

export class CreateAgentDto {
  @ApiProperty({ example: '王代理' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'agent_a01' })
  @IsString()
  loginAccount: string;

  @ApiProperty({ example: 'P@ssw0rd' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ description: '父代理 ID（建立 B 時填）' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiProperty({ example: 0.3, description: '0~1 之間，0.3 = 30%' })
  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  contactInfo?: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  selfReferralAllowed?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canSetSubRate?: boolean;
}

export class UpdateAgentDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsObject() contactInfo?: Record<string, unknown> | null;
  @IsOptional() @IsBoolean() selfReferralAllowed?: boolean;
  @IsOptional() @IsBoolean() canSetSubRate?: boolean;
}

export class UpdateAgentRateDto {
  @ApiProperty({ example: 0.35 })
  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number;
}

export class ChangeAgentParentDto {
  @ApiProperty()
  @IsUUID()
  newParentId: string;
}

// ─────────── 推廣連結 ───────────

export class CreateReferralLinkDto {
  @IsOptional() @IsString() label?: string;
}

export class ToggleReferralLinkDto {
  @IsBoolean()
  active: boolean;
}

// ─────────── 玩家歸屬 ───────────

export class ChangeAttributionDto {
  @IsUUID()
  toAgentId: string;

  @IsOptional() @IsString() reason?: string;
}

// ─────────── 結算 ───────────

export class AddAdjustmentDto {
  @ApiProperty({ description: '可正可負', example: -18 })
  @IsNumber()
  amount: number;

  @IsString()
  reason: string;

  @IsIn(['manual', 'bonus'])
  sourceType: 'manual' | 'bonus';
}

// ─────────── 退款 ───────────

export class ApplyRefundDto {
  @ApiProperty({ description: '對應 payment_transactions.id' })
  @IsUUID()
  transactionId: string;

  @IsOptional() @IsString() reason?: string;
}

// ─────────── 系統設定 ───────────

export class UpdateSettingDto {
  @IsString()
  key: string;

  // value 可能是任意型別
  value: unknown;
}
