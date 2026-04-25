import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type ForumPushItemType = 'link' | 'screenshot';
export type ForumPushItemReviewResult = 'pending' | 'passed' | 'rejected';

/**
 * 推文明細 —— 一筆申請含多筆推文（最多數由後台設定）
 * 審核時每筆獨立開關 pass/reject，最後由 service 算 passedCount 發獎
 */
@Entity('forum_push_items')
@Index(['applicationId', 'sortOrder'])
@Index(['normalizedUrl'])
export class ForumPushItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar' })
  type: ForumPushItemType;

  /** 原始內容：link 類型存 URL；screenshot 類型存 MinIO public URL */
  @Column({ type: 'text' })
  content: string;

  /** link 類型正規化後的 URL（去 query / fragment / trailing slash），用於跨申請重複偵測 */
  @Column({ name: 'normalized_url', type: 'varchar', nullable: true })
  normalizedUrl: string | null;

  @Column({ name: 'review_result', type: 'varchar', default: 'pending' })
  reviewResult: ForumPushItemReviewResult;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
