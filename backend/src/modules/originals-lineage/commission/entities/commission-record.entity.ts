import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 分潤明細
 * - 一筆儲值交易會展開成 1~2 筆 commission_records（A 一筆、B 一筆；若只有 A 則一筆）
 * - transaction_id 對應 payment_transactions.id
 * - rate_snapshot / upstream_rate_snapshot 是為了保證歷史分潤永不重算
 * - period_key: 結算期標識，格式 'YYYY-MM'（以結算週期歸期為準，不一定等於交易月份）
 * - settlement_id: 結算後填入，NULL 表示尚未結算
 */
@Entity('commission_records')
@Index('idx_commission_records_tx', ['transactionId'])
@Index('idx_commission_records_agent', ['agentId'])
@Index('idx_commission_records_settlement', ['settlementId'])
@Index('idx_commission_records_period', ['periodKey'])
@Index('idx_commission_records_agent_settlement', ['agentId', 'settlementId'])
export class CommissionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ type: 'smallint' })
  level: number;

  @Column({ name: 'base_amount', type: 'decimal', precision: 12, scale: 2 })
  baseAmount: number;

  @Column({ name: 'rate_snapshot', type: 'decimal', precision: 5, scale: 4 })
  rateSnapshot: number;

  @Column({
    name: 'upstream_rate_snapshot',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  upstreamRateSnapshot: number | null;

  @Column({
    name: 'commission_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  commissionAmount: number;

  @Column({ name: 'period_key', type: 'varchar', length: 16 })
  periodKey: string;

  @Column({ name: 'settlement_id', type: 'uuid', nullable: true })
  settlementId: string | null;

  @Column({ name: 'paid_at', type: 'timestamp' })
  paidAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
