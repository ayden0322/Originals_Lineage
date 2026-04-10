import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import type { ProductCategory } from './product.entity';

/**
 * 商品範本（常用設定）
 *
 * 共用範圍：所有管理者可見可用。
 * snapshot 內存放 CreateProductDto 的所有欄位（不含 id/timestamp），
 * 套用時前端把 snapshot 直接塞進表單。
 */
@Entity('product_templates')
export class ProductTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar' })
  @Index('idx_product_templates_category')
  category: ProductCategory;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
