import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ForumPushApplicationStatus = 'pending' | 'reviewed';
export type ForumPushRewardStatus = 'pending' | 'sent' | 'partial' | 'failed';

/**
 * 論壇推文獎勵申請主檔
 *
 * 流程：
 *   pending    —— 玩家送出，等待審核
 *   reviewed   —— 後台審核完成（子表 items 逐筆 pass/reject），同時觸發發獎
 *
 * 發獎狀態（reviewed 之後才有意義）：
 *   pending    —— 尚未觸發發獎（或 passedCount = 0）
 *   sent       —— 所有 reward-config 道具皆寫入遊戲庫成功
 *   partial    —— 部分道具寫入失敗，rewardPayload 記錄詳情
 *   failed     —— 全部失敗
 */
@Entity('forum_push_applications')
@Index(['websiteUserId', 'createdAt'])
@Index(['status', 'createdAt'])
export class ForumPushApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'website_user_id', type: 'uuid' })
  websiteUserId: string;

  /** 送出時快照，避免事後玩家改綁定或改角色無法追蹤 */
  @Column({ name: 'game_account', type: 'varchar' })
  gameAccount: string;

  @Column({ name: 'game_character', type: 'varchar', nullable: true })
  gameCharacter: string | null;

  @Column({ name: 'fb_name', type: 'varchar' })
  fbName: string;

  @Column({ name: 'fb_link', type: 'varchar' })
  fbLink: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: ForumPushApplicationStatus;

  /** 審核通過的 item 筆數（reviewed 後計算） */
  @Column({ name: 'passed_count', type: 'int', default: 0 })
  passedCount: number;

  @Column({ name: 'reward_status', type: 'varchar', default: 'pending' })
  rewardStatus: ForumPushRewardStatus;

  /** 實際發了什麼的快照（道具清單 + 遊戲庫 insertId + 失敗錯誤訊息） */
  @Column({ name: 'reward_payload', type: 'jsonb', nullable: true })
  rewardPayload: Array<{
    itemCode: number;
    itemName: string;
    quantity: number;
    insertId?: number;
    error?: string;
  }> | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
