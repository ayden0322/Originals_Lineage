import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 分潤系統設定（key-value）
 * 常用 key：
 * - settlement_day: 結算日（1~31，>當月天數時抓當月最後一天）
 * - cookie_days: 推薦 Cookie 有效天數，預設 30
 * - mask_player_id_for_agents: 是否在代理後台遮罩玩家 ID（true/false）
 * - self_referral_default: 新代理預設是否允許自推自玩
 * - max_sub_rate: 當 can_set_sub_rate=true 時的比例上限（預設 1.0 = 100%）
 */
@Entity('commission_settings')
export class CommissionSetting {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
