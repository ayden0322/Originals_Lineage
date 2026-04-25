import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

export type DuplicateUrlPolicy = 'warn' | 'block';

/**
 * 論壇推文全域設定（singleton，只會有一列）
 */
@Entity('forum_push_settings')
export class ForumPushSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 每會員每日最多可送出幾次申請 */
  @Column({ name: 'max_applications_per_day', type: 'int', default: 1 })
  maxApplicationsPerDay: number;

  /** 每次申請最多可填幾筆推文 */
  @Column({ name: 'max_items_per_application', type: 'int', default: 5 })
  maxItemsPerApplication: number;

  /** 重複連結處理策略：警告 or 擋下 */
  @Column({
    name: 'duplicate_url_policy',
    type: 'varchar',
    default: 'warn',
  })
  duplicateUrlPolicy: DuplicateUrlPolicy;

  /** 活動說明（顯示於前台申請頁頂部） */
  @Column({ name: 'page_description', type: 'text', nullable: true })
  pageDescription: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
