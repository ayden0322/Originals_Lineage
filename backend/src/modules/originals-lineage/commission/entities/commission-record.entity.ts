import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 分潤明細
 * - 一筆儲值交易會展開成 1~2 筆 commission_records（A 一筆、B 一筆；若只有 A 則一筆）
 * - transaction_id 對應金流商回傳的外部 transactionId（payment_transactions.provider_transaction_id）
 *   ※ 不是 payment_transactions.id（UUID），因為 mock / ECPay / SmilePay 的 tx id 是字串格式
 * - rate_snapshot / upstream_rate_snapshot 是為了保證歷史分潤永不重算
 * - period_key: 結算期標識，格式 'YYYY-MM'（以結算週期歸期為準，不一定等於交易月份）
 * - settlement_id: 結算後填入，NULL 表示尚未結算
 */
@Entity('commission_records')
@Index('idx_commission_records_tx', ['transactionId'])
@Index('idx_commission_records_agent', ['agentId'])
@Index('idx_commission_records_player', ['playerId'])
@Index('idx_commission_records_settlement', ['settlementId'])
@Index('idx_commission_records_period', ['periodKey'])
@Index('idx_commission_records_agent_settlement', ['agentId', 'settlementId'])
@Index('idx_commission_records_period_clan', ['periodKey', 'clanId'])
export class CommissionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 64 })
  transactionId: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  /**
   * 該筆交易付款的玩家 ID（website_users.id）
   * 存在 commission_records 是為了：
   *  1. 報表 join 不會發生 agent→players 一對多的 Cartesian 爆行
   *  2. 歷史分潤紀錄永遠知道是「哪個玩家貢獻的」，不受後續改綁影響
   */
  @Column({ name: 'player_id', type: 'uuid' })
  playerId: string;

  @Column({ type: 'smallint' })
  level: number;

  @Column({ name: 'base_amount', type: 'decimal', precision: 12, scale: 2 })
  baseAmount: number;

  @Column({ name: 'rate_snapshot', type: 'decimal', precision: 5, scale: 4 })
  rateSnapshot: number;

  @Column({
    name: 'upstream_rate_snapshot',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  upstreamRateSnapshot: number | null;

  @Column({
    name: 'commission_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  commissionAmount: number;

  @Column({ name: 'period_key', type: 'varchar', length: 16 })
  periodKey: string;

  @Column({ name: 'settlement_id', type: 'uuid', nullable: true })
  settlementId: string | null;

  @Column({ name: 'paid_at', type: 'timestamp' })
  paidAt: Date;

  /**
   * 血盟歸屬 snapshot（儲值當下的角色所在血盟）
   * - clan_id：遊戲庫 characters.ClanID；無血盟或查不到遊戲庫 → NULL
   * - clan_name：遊戲庫 clan_data.clan_name；用來避免血盟改名後歷史資料錯亂
   * - 既有資料由 backfill 腳本補上（以執行當下的血盟狀態為準）
   */
  @Column({ name: 'clan_id', type: 'int', nullable: true })
  clanId: number | null;

  @Column({ name: 'clan_name', type: 'varchar', length: 64, nullable: true })
  clanName: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
