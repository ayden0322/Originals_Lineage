import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

/**
 * 發獎紀錄
 *
 * 一筆 (reservation × milestone) = 一筆 claim
 *
 * 狀態流轉：
 *   pending    —— 批次已建立，等待背景任務寄送
 *   processing —— 背景任務已 atomic 搶領，正在寫入遊戲 DB（含 4 次重試）
 *   sent       —— 已成功寫入 輔助_獎勵發送，並反查確認存在
 *   failed     —— 重試 4 次後仍失敗，需人工處理
 *
 * 補救機制：processing 狀態超過 5 分鐘視為卡住，recovery cron 會依
 * game_insert_id 反查遊戲 DB，有則標 sent、無則退回 pending 重跑
 */
export type RewardClaimStatus = 'pending' | 'processing' | 'sent' | 'failed';

@Entity('reservation_reward_claims')
@Unique(['reservationId', 'milestoneId'])
@Index(['milestoneId', 'status'])
export class RewardClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reservation_id', type: 'uuid' })
  reservationId: string;

  @Column({ name: 'milestone_id', type: 'uuid' })
  milestoneId: string;

  /** 快照：避免預約者改名或里程碑變更後追蹤困難 */
  @Column({ name: 'game_account_snapshot', type: 'varchar' })
  gameAccountSnapshot: string;

  @Column({ name: 'reward_name_snapshot', type: 'varchar' })
  rewardNameSnapshot: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: RewardClaimStatus;

  /** 發放備註（失敗原因、信件編號等） */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** 實際寄送時間 */
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  /** 執行發送操作的管理員帳號 id */
  @Column({ name: 'sent_by', type: 'uuid', nullable: true })
  sentBy: string | null;

  /** 寫入遊戲 DB「輔助_獎勵發送」後的 auto-increment id，反查與去重用 */
  @Column({ name: 'game_insert_id', type: 'int', nullable: true })
  gameInsertId: number | null;

  /** 本次處理已重試次數（0~3），每次 processSingleClaim 結束歸零或保留 */
  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  /** 最後一次嘗試寄送時間，recovery cron 判斷 processing 是否卡住 */
  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
