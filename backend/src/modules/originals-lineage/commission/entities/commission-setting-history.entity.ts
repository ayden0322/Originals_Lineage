import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 分潤系統設定變更軌跡
 * - 特別為「結算日變更」設計：effective_from_period 指定下期才套用新值
 * - 每次 cron 跑結算時查詢：該期要用哪個 settlement_day
 */
@Entity('commission_setting_history')
@Index('idx_commission_setting_hist_key', ['key'])
export class CommissionSettingHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue: unknown;

  @Column({ name: 'new_value', type: 'jsonb' })
  newValue: unknown;

  @Column({
    name: 'effective_from_period',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  effectiveFromPeriod: string | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
