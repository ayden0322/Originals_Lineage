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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
