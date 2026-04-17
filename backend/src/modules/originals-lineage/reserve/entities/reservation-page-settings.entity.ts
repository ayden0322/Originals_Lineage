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

  @Column({ name: 'page_title', type: 'varchar', default: '新兵報到活動' })
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

  /** 全畫面 hero 背景圖 URL */
  @Column({ name: 'hero_background_url', type: 'varchar', nullable: true })
  heroBackgroundUrl: string | null;

  /** 背景遮罩透明度（0-1），預設 0.55 讓文字好閱讀 */
  @Column({
    name: 'hero_overlay_opacity',
    type: 'float',
    default: 0.55,
  })
  heroOverlayOpacity: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
