import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 玩家歸屬變更軌跡
 * - 每次管理者調整歸屬都留一筆紀錄
 * - 歷史 commission_records 不動，只有「調整之後的新交易」才會算新代理
 */
@Entity('commission_player_attribution_history')
@Index('idx_commission_player_attr_hist_player', ['playerId'])
export class PlayerAttributionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId: string;

  @Column({ name: 'from_agent_id', type: 'uuid', nullable: true })
  fromAgentId: string | null;

  @Column({ name: 'to_agent_id', type: 'uuid' })
  toAgentId: string;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
