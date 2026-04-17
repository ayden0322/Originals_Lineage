import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  PaymentVerification,
} from '../interfaces/payment-provider.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly providerCode = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);

  /**
   * 正式環境（NODE_ENV=production）禁止使用 mock 金流。
   * 即使 DB 有人誤建了 type=mock 的 gateway 或把 routes 指向它，
   * 這裡會直接拒絕建立訂單，避免「玩家按下去就被自動發貨」的安全漏洞。
   */
  private ensureNotProduction() {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(
        '[SECURITY] 正式環境嘗試使用 mock 金流已被拒絕。請到後台將對應的 payment_channel_routes 指向真實 gateway。',
      );
      throw new Error('正式環境禁止使用 mock 金流，請聯絡管理者檢查金流設定');
    }
  }

  async createOrder(
    params: CreatePaymentParams,
    credentials: Record<string, unknown>,
  ): Promise<PaymentResult> {
    this.ensureNotProduction();

    const transactionId = `mock_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // 本地測試：mock 沒有真正的付款頁，這裡 fire-and-forget 自己打一次 webhook，
    // 模擬「玩家在金流商付款成功 → 金流商主動 callback」的流程。
    // 延遲 500ms 是為了讓 createTransaction 的 DB 寫入先 commit，避免 callback 找不到 tx。
    setTimeout(() => {
      void this.simulateCallback(params, transactionId);
    }, 500);

    // 注意：mock 金流「故意不回傳 paymentUrl」。
    // 原因：前端 shop 頁面收到 paymentUrl 會 window.location.href 過去，
    // 但 mock 沒有真的付款頁，若給假網址（mock-payment.local）玩家會看到 DNS 錯誤。
    // 改為不回 URL，前端走「訂單建立成功」分支，500ms 後我們自己打 webhook 完成付款模擬。
    return {
      transactionId,
      status: 'pending',
    };
  }

  /**
   * 自打 webhook：用 returnUrl（PaymentService 在建單時帶進來的 webhook 網址）回頭通知後端。
   * 失敗只記 log，不影響原請求。
   */
  private async simulateCallback(
    params: CreatePaymentParams,
    transactionId: string,
  ): Promise<void> {
    try {
      const res = await fetch(params.returnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: params.orderId,
          transactionId,
          amount: params.amount,
          status: 'paid',
        }),
      });
      this.logger.log(
        `Mock auto-callback → ${params.returnUrl} (order=${params.orderId}) status=${res.status}`,
      );
    } catch (err) {
      this.logger.warn(
        `Mock auto-callback failed: ${(err as Error).message}`,
      );
    }
  }

  async verifyCallback(
    body: Record<string, unknown>,
    headers: Record<string, string>,
    credentials: Record<string, unknown>,
  ): Promise<PaymentVerification> {
    this.ensureNotProduction();
    return {
      orderId: (body.orderId as string) ?? '',
      transactionId: (body.transactionId as string) ?? '',
      amount: (body.amount as number) ?? 0,
      status: 'paid',
      rawData: body,
    };
  }

  async queryOrder(
    transactionId: string,
    credentials: Record<string, unknown>,
  ): Promise<{ status: string; paidAt?: Date }> {
    return {
      status: 'paid',
      paidAt: new Date(),
    };
  }
}
