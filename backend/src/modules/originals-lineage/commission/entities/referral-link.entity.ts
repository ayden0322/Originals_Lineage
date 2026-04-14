import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 推廣連結
 * - code: 短碼，出現在網址 ?ref=xxx
 * - 一個代理可以有多組連結（不同活動）
 * - 停用的連結新玩家掃 QR 不會綁定（視為無歸屬）
 */
@Entity('commission_referral_links')
@Index('idx_commission_referral_links_agent', ['agentId'])
@Index('idx_commission_referral_links_code', ['code'], { unique: true })
export class ReferralLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
