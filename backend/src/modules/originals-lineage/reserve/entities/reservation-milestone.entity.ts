import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reservation_milestones')
export class ReservationMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int')
  threshold: number;

  @Column({ name: 'reward_name' })
  rewardName: string;

  @Column({ name: 'reward_description', type: 'text', nullable: true })
  rewardDescription: string | null;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** 綁定的遊戲道具 item_id（etcitem.item_id），未綁定則 null 不可發放 */
  @Column({ name: 'game_item_id', type: 'int', nullable: true })
  gameItemId: number | null;

  /** 綁定的遊戲道具名稱快照（淨化過顏色控制碼） */
  @Column({ name: 'game_item_name', type: 'varchar', nullable: true })
  gameItemName: string | null;

  /** 每人發放數量 */
  @Column({ name: 'game_item_quantity', type: 'int', default: 1 })
  gameItemQuantity: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
