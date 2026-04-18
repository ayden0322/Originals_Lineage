import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 禮包內容物單項 */
export interface PackageItem {
  name: string;
  quantity: number;
  description?: string;
  iconUrl?: string;
}

/**
 * 遊戲禮包（純展示）
 * - 與 products 表分離，products 是贊助金流用
 * - 本表純展示遊戲內「以四海銀票兌換」的禮包清單，不走金流
 */
@Entity('game_packages')
export class GamePackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  /** 卡片縮圖 */
  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  /** Modal 展示大圖 */
  @Column({ name: 'large_image_url', type: 'varchar', nullable: true })
  largeImageUrl: string | null;

  /** 兌換所需貨幣數量（單位在 packageSettings.currencyName） */
  @Column({ name: 'currency_amount', type: 'int', default: 0 })
  currencyAmount: number;

  /** 禮包內容物列表（JSONB），items: [{ name, quantity, description?, iconUrl? }]（舊資料用，新資料以 contentHtml 為主） */
  @Column({ name: 'items_json', type: 'jsonb', default: () => "'[]'" })
  items: PackageItem[];

  /** 禮包內容富文本（HTML）— 取代結構化 items，前台顯示時優先使用 */
  @Column({ name: 'content_html', type: 'text', nullable: true })
  contentHtml: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
