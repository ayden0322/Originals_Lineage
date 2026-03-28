import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_number', unique: true })
  @Index('idx_orders_number')
  orderNumber: string;

  @Column({ name: 'member_binding_id' })
  @Index('idx_orders_member')
  memberBindingId: string;

  @Column('decimal', { name: 'total_amount', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'paid' | 'delivering' | 'completed' | 'failed' | 'refunded';

  @Column({ name: 'payment_transaction_id', type: 'varchar', nullable: true })
  paymentTransactionId: string | null;

  @Column({ name: 'delivery_status', type: 'varchar', default: 'pending' })
  deliveryStatus: 'pending' | 'processing' | 'delivered' | 'failed';

  @Column({ name: 'delivery_details', type: 'jsonb', nullable: true })
  deliveryDetails: Record<string, unknown> | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
