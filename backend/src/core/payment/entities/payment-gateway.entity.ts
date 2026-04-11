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

  /** 金流商類型（用來區分前端顯示與 Adapter 行為），通常等同 providerCode */
  @Column({
    name: 'vendor_type',
    type: 'varchar',
    length: 32,
    default: 'mock',
  })
  vendorType: 'smilepay' | 'ecpay' | 'antpay' | 'tx2' | 'mock';

  /** 顯示在金流商收銀台的商品名稱 */
  @Column({ name: 'product_name', type: 'varchar', length: 128, default: '' })
  productName: string;

  /** 單筆最小金額（0 表示不限制） */
  @Column({ name: 'min_amount', type: 'int', default: 0 })
  minAmount: number;

  /** 開單間隔（分鐘，0 表示不限制） */
  @Column({ name: 'order_interval', type: 'int', default: 0 })
  orderInterval: number;

  /** 實名制欄位開關 */
  @Column({ name: 'real_name_settings', type: 'jsonb', default: '{}' })
  realNameSettings: {
    name?: boolean;
    phone?: boolean;
    email?: boolean;
    idNumber?: boolean;
    bankAccount?: boolean;
    address?: boolean;
  };

  /** 通道級別設定（ATM / 超商 / 信用卡，含啟用、限額） */
  @Column({ name: 'channel_settings', type: 'jsonb', default: '{}' })
  channelSettings: {
    atm?: {
      enabled: boolean;
      displayName?: string;
      minAmount?: number;
      maxAmount?: number;
    };
    cvs?: {
      enabled: boolean;
      channels?: Array<{
        code: string;
        displayName: string;
        enabled: boolean;
        minAmount?: number;
        maxAmount?: number;
      }>;
    };
    creditCard?: {
      enabled: boolean;
      minAmount?: number;
      maxAmount?: number;
    };
  };

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
