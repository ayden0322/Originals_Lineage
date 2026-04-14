import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 結算加減項
 * - 用於退款沖銷（source_type = 'refund'）、管理者手動調整（manual）、補發獎金（bonus）
 * - amount 可正可負
 * - source_transaction_id: 若是退款沖銷，指向原交易（payment_transactions.id），用於追溯
 */
@Entity('commission_settlement_adjustments')
@Index('idx_commission_settlement_adj_settlement', ['settlementId'])
@Index('idx_commission_settlement_adj_source_tx', ['sourceTransactionId'])
export class SettlementAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'settlement_id', type: 'uuid' })
  settlementId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'source_type', type: 'varchar', length: 20 })
  sourceType: 'refund' | 'manual' | 'bonus';

  @Column({ name: 'source_transaction_id', type: 'uuid', nullable: true })
  sourceTransactionId: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
