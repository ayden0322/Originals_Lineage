import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 代理分潤比例歷史（時段快照）
 * - 每次調整比例，把舊紀錄的 effective_to 填上 now()，並新增一筆 effective_to = NULL 的新紀錄
 * - 查詢某時刻的有效比例：WHERE agent_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)
 * - rate: 0.3000 = 30%
 */
@Entity('commission_agent_rates')
@Index('idx_commission_agent_rates_agent', ['agentId'])
@Index('idx_commission_agent_rates_effective', ['agentId', 'effectiveFrom', 'effectiveTo'])
export class AgentRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  rate: number;

  @Column({ name: 'effective_from', type: 'timestamp' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamp', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
