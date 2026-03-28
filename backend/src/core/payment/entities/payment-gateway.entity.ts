import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('payment_gateways')
@Unique('uq_payment_gateways_module_provider', ['moduleCode', 'providerCode'])
export class PaymentGateway {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'module_code' })
  moduleCode: string;

  @Column({ name: 'provider_code' })
  providerCode: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ type: 'jsonb', default: '{}' })
  credentials: Record<string, unknown>;

  @Column({ name: 'supported_methods', type: 'simple-array', default: '' })
  supportedMethods: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_sandbox', default: true })
  isSandbox: boolean;

  @Column({ default: 0 })
  priority: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
