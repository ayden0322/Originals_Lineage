import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProductCategory = 'diamond' | 'game_item' | 'monthly_card';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  // 鑽石類專用：發放鑽石數量
  @Column({ name: 'diamond_amount', default: 0 })
  diamondAmount: number;

  // 遊戲禮包/月卡類專用：對應 ancestor.etcitem.item_id
  @Column({ name: 'game_item_id', type: 'int', nullable: true })
  gameItemId: number | null;

  // 遊戲禮包/月卡類專用：冗存 ancestor.etcitem.name（避免遊戲改名失同步）
  @Column({ name: 'game_item_name', type: 'varchar', length: 120, nullable: true })
  gameItemName: string | null;

  // 遊戲禮包/月卡類專用：每次發放數量（預設 1）
  @Column({ name: 'game_item_quantity', default: 1 })
  gameItemQuantity: number;

  @Column({ type: 'varchar' })
  category: ProductCategory;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ default: -1 })
  stock: number;

  // 帳號總購買上限（取代舊 maxPerUser，0 = 不限）
  @Column({ name: 'max_per_user', default: 0 })
  accountLimit: number;

  // 每日購買上限（null = 不限）
  @Column({ name: 'daily_limit', type: 'int', nullable: true })
  dailyLimit: number | null;

  // 每週購買上限（null = 不限）
  @Column({ name: 'weekly_limit', type: 'int', nullable: true })
  weeklyLimit: number | null;

  // 每週重置星期（0=週日 ~ 6=週六）
  @Column({ name: 'weekly_reset_day', type: 'smallint', nullable: true })
  weeklyResetDay: number | null;

  // 每週重置時點（小時，0~23）
  @Column({ name: 'weekly_reset_hour', type: 'smallint', nullable: true })
  weeklyResetHour: number | null;

  // 每月購買上限（null = 不限，每月 1 號 00:00 重置）
  @Column({ name: 'monthly_limit', type: 'int', nullable: true })
  monthlyLimit: number | null;

  // 角色最低等級限制（null = 不限）
  @Column({ name: 'required_level', type: 'int', nullable: true })
  requiredLevel: number | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'start_time', type: 'timestamp', nullable: true })
  startTime: Date | null;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
