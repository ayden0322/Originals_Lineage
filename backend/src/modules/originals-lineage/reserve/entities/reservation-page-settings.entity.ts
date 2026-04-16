import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reservation_page_settings')
export class ReservationPageSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'page_title', type: 'varchar', default: '事前預約活動' })
  pageTitle: string;

  @Column({ name: 'page_subtitle', type: 'varchar', nullable: true })
  pageSubtitle: string | null;

  @Column({ name: 'page_description', type: 'text', nullable: true })
  pageDescription: string | null;

  @Column({ name: 'count_base', type: 'int', default: 0 })
  countBase: number;

  @Column({ name: 'deadline_at', type: 'timestamp', nullable: true })
  deadlineAt: Date | null;

  @Column({ name: 'is_distribution_locked', type: 'boolean', default: false })
  isDistributionLocked: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
