import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SiteSection } from './site-section.entity';

@Entity('carousel_slides')
export class CarouselSlide {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  sectionId: string | null;

  @ManyToOne(() => SiteSection, (section) => section.slides, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section: SiteSection | null;

  // 媒體類型：image 或 video，二擇一
  @Column({ name: 'media_type', type: 'varchar', default: 'image' })
  mediaType: 'image' | 'video';

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'video_url', type: 'varchar', nullable: true })
  videoUrl: string | null;

  // 自動輪播秒數（統一值由前端帶入，但存於每張 slide 備用）
  @Column({ name: 'auto_play_seconds', type: 'int', default: 6 })
  autoPlaySeconds: number;

  // 連結開關
  @Column({ name: 'link_enabled', type: 'boolean', default: false })
  linkEnabled: boolean;

  @Column({ name: 'link_url', type: 'varchar', nullable: true })
  linkUrl: string | null;

  @Column({ name: 'sort_order', default: 1 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
