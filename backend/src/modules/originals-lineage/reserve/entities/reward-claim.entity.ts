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
 *   pending  —— 里程碑達成，系統已為此預約者建立紀錄，但遊戲內尚未寄送
 *   sent     —— 工作人員已在遊戲後台寄出獎勵
 *   failed   —— 發放失敗（例如角色不存在），需人工處理
 */
export type RewardClaimStatus = 'pending' | 'sent' | 'failed';

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
