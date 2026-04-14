import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 代理父級變更軌跡
 * - 涵蓋兩種情境：
 *   1) 升格（promote）：from_parent_id 有值，to_parent_id = NULL（B → A）
 *   2) 轉組（change_parent）：from_parent_id 與 to_parent_id 皆有值（B 換 A）
 * - 歷史 commission_records 不動，這張表只是給管理者稽核用
 */
@Entity('commission_agent_parent_history')
@Index('idx_commission_agent_parent_hist_agent', ['agentId'])
export class AgentParentHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ name: 'from_parent_id', type: 'uuid', nullable: true })
  fromParentId: string | null;

  @Column({ name: 'to_parent_id', type: 'uuid', nullable: true })
  toParentId: string | null;

  @Column({ name: 'action', type: 'varchar', length: 20 })
  action: 'promote' | 'change_parent';

  @Column({
    name: 'old_rate_snapshot',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  oldRateSnapshot: number | null;

  @Column({
    name: 'new_rate_snapshot',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  newRateSnapshot: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
