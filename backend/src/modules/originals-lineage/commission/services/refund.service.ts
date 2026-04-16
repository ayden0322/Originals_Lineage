import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionRecord } from '../entities/commission-record.entity';
import { SettlementAdjustment } from '../entities/settlement-adjustment.entity';
import { SettlementService } from './settlement.service';
import { CommissionSettingsService } from './commission-settings.service';
import { getCurrentPeriod } from '../utils/period.util';

/**
 * 退款沖銷服務
 *
 * 觸發時機：管理者把訂單改為 refunded 後呼叫
 * 行為：
 *  - 找出該 transaction_id 對應的所有 commission_records
 *  - 為每筆代理在「當前期」的 settlement 上加一筆負值 adjustment
 *  - 不論原 commission 是否已結算，沖銷一律記在「當前期」
 *    （已結算過的舊期不動，避免追改歷史結算）
 *  - 冪等：同一 transaction 重複沖銷會被偵測並阻擋
 */
@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(CommissionRecord)
    private readonly recordRepo: Repository<CommissionRecord>,
    @InjectRepository(SettlementAdjustment)
    private readonly adjustmentRepo: Repository<SettlementAdjustment>,
    private readonly settlementService: SettlementService,
    private readonly settings: CommissionSettingsService,
  ) {}

  async applyRefund(params: {
    transactionId: string;
    operatorId?: string;
    reason?: string;
  }): Promise<{ adjustmentsCreated: number }> {
    // 冪等檢查：同一筆交易不可重複沖銷
    const alreadyRefunded = await this.adjustmentRepo.findOne({
      where: {
        sourceTransactionId: params.transactionId,
        sourceType: 'refund',
      },
    });
    if (alreadyRefunded) {
      throw new ConflictException(
        `交易 ${params.transactionId} 已沖銷過，不可重複操作`,
      );
    }

    const records = await this.recordRepo.find({
      where: { transactionId: params.transactionId },
    });
    if (records.length === 0) {
      throw new NotFoundException(
        `交易 ${params.transactionId} 沒有對應的分潤紀錄`,
      );
    }

    // 取當前期
    const settlementDay = await this.settings.get<number>('settlement_day', 5);
    const cur = getCurrentPeriod(new Date(), settlementDay);

    let count = 0;
    for (const rec of records) {
      // SYSTEM 紀錄 amount=0，不需要沖銷
      if (Number(rec.commissionAmount) === 0) continue;

      const settlement = await this.settlementService.getOrCreatePendingSettlement({
        agentId: rec.agentId,
        periodKey: cur.periodKey,
        periodStart: cur.periodStart,
        periodEnd: cur.periodEnd,
      });

      await this.settlementService.addAdjustment({
        settlementId: settlement.id,
        amount: -Number(rec.commissionAmount),
        reason:
          params.reason ??
          `退款沖銷：訂單 ${params.transactionId}（原分潤 ${rec.commissionAmount}）`,
        sourceType: 'refund',
        sourceTransactionId: params.transactionId,
        operatorId: params.operatorId,
      });
      count++;
    }

    this.logger.log(
      `退款沖銷完成 tx=${params.transactionId}，產生 ${count} 筆扣項`,
    );
    return { adjustmentsCreated: count };
  }
}
