import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('payment_transactions')
@Index('idx_payment_transactions_order', ['orderId'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'module_code' })
  moduleCode: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'provider_name' })
  providerName: string;

  @Column({ name: 'provider_transaction_id', type: 'varchar', nullable: true })
  providerTransactionId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'TWD' })
  currency: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod: string | null;

  @Column({ name: 'callback_data', type: 'jsonb', nullable: true })
  callbackData: Record<string, unknown> | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
