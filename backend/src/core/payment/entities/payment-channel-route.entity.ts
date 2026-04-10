import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/**
 * 付款方式 → 金流商 一對一路由表
 *
 * 一個 module 內，每個 paymentMethod (atm / cvs) 只會對應到一個 gateway。
 * 玩家只看到付款方式按鈕，背後實際走哪家金流商由管理者在「伺服器金流設定」決定。
 *
 * gatewayId 為 null 表示「該付款方式未開放」。
 */
@Entity('payment_channel_routes')
@Unique('uq_payment_channel_routes_module_method', ['moduleCode', 'paymentMethod'])
export class PaymentChannelRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'module_code' })
  moduleCode: string;

  /** 付款方式：第一期僅支援 atm / cvs */
  @Column({ name: 'payment_method', type: 'varchar', length: 32 })
  paymentMethod: 'atm' | 'cvs';

  /** 對應的金流商 id；null = 尚未設定（玩家看不到該付款方式） */
  @Column({ name: 'gateway_id', type: 'uuid', nullable: true })
  gatewayId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
