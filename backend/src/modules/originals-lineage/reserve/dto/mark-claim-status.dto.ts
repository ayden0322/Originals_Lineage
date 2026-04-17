import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export type MarkClaimStatus = 'pending' | 'sent' | 'failed';

export class MarkClaimStatusDto {
  @IsArray()
  @IsUUID('4', { each: true })
  claimIds: string[];

  @IsEnum(['pending', 'sent', 'failed'])
  status: MarkClaimStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
