import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 結算期
 * - 每個代理每期一筆
 * - status 流：pending（待確認）→ settled（管理者確認）→ paid（線下轉帳完成）
 * - final_amount = total_commission + total_adjustment，允許為負（跨期滾入扣項）
 */
@Entity('commission_settlements')
@Index('idx_commission_settlements_agent', ['agentId'])
@Index('idx_commission_settlements_period', ['periodKey'])
@Index('idx_commission_settlements_agent_period', ['agentId', 'periodKey'], {
  unique: true,
})
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ name: 'period_key', type: 'varchar', length: 16 })
  periodKey: string;

  @Column({ name: 'period_start', type: 'timestamp' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd: Date;

  @Column({
    name: 'total_commission',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalCommission: number;

  @Column({
    name: 'total_adjustment',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalAdjustment: number;

  @Column({
    name: 'final_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  finalAmount: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'settled' | 'paid';

  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt: Date | null;

  @Column({ name: 'settled_by', type: 'uuid', nullable: true })
  settledBy: string | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'paid_by', type: 'uuid', nullable: true })
  paidBy: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
