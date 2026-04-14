import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 代理主表
 * - parent_id: 父代理 ID，NULL 表示一級代理（A）；非 NULL 表示二級代理（B）
 * - 保留 parent_id 欄位以便未來擴展成多層代理
 * - is_system: 標記 SYSTEM 虛擬代理（全系統僅一筆為 true），用於承接無歸屬玩家
 */
@Entity('commission_agents')
@Index('idx_commission_agents_parent', ['parentId'])
@Index('idx_commission_agents_code', ['code'], { unique: true })
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'login_account', type: 'varchar', length: 64, unique: true })
  loginAccount: string;

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  @Column({ name: 'contact_info', type: 'jsonb', nullable: true })
  contactInfo: Record<string, unknown> | null;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'suspended';

  @Column({ name: 'self_referral_allowed', default: false })
  selfReferralAllowed: boolean;

  @Column({ name: 'can_set_sub_rate', default: false })
  canSetSubRate: boolean;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
