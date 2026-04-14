import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 玩家歸屬（一個玩家一筆）
 * - player_id: 對應 website_users.id
 * - agent_id: 可以是 SYSTEM 虛擬代理（表示無歸屬）
 * - 首次歸屬終身綁定，除非管理者手動調整
 */
@Entity('commission_player_attributions')
@Index('idx_commission_player_attr_agent', ['agentId'])
export class PlayerAttribution {
  @PrimaryColumn({ name: 'player_id', type: 'uuid' })
  playerId: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ name: 'link_id', type: 'uuid', nullable: true })
  linkId: string | null;

  @Column({ name: 'linked_source', type: 'varchar', length: 20 })
  linkedSource: 'cookie' | 'register' | 'manual' | 'system';

  @CreateDateColumn({ name: 'linked_at' })
  linkedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
