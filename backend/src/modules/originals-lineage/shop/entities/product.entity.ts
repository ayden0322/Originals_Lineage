import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ name: 'diamond_amount' })
  diamondAmount: number;

  @Column({ type: 'varchar' })
  category: 'diamond_pack' | 'special_bundle' | 'event_pack';

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ default: -1 })
  stock: number;

  @Column({ name: 'max_per_user', default: 0 })
  maxPerUser: number;

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
