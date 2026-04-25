import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 獎勵道具設定 —— 可多筆，每筆代表「每通過 1 則推文發的一項道具」
 * 範例：通過 5 則推文，且有一筆設定 { itemCode: 80033, quantityPerPass: 5 }
 *       → 呼叫 insertGiftReward(accountName, 80033, '推廣幣', 25)
 */
@Entity('forum_push_reward_configs')
export class ForumPushRewardConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 遊戲道具編號（對應 etcitem.item_id） */
  @Column({ name: 'item_code', type: 'int' })
  itemCode: number;

  @Column({ name: 'item_name', type: 'varchar' })
  itemName: string;

  /** 每通過 1 則推文發的數量 */
  @Column({ name: 'quantity_per_pass', type: 'int' })
  quantityPerPass: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
