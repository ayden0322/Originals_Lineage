import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('module_configs')
export class ModuleConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'module_code', unique: true })
  moduleCode: string;

  @Column({ name: 'module_name' })
  moduleName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'payment_enabled', default: false })
  paymentEnabled: boolean;

  @Column({ name: 'line_bot_enabled', default: false })
  lineBotEnabled: boolean;

  @Column({ name: 'config_json', type: 'jsonb', default: '{}' })
  configJson: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
