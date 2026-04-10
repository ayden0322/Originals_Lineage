import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  PaymentVerification,
} from '../interfaces/payment-provider.interface';

/**
 * TX2 金流商 Provider — 空殼實作
 *
 * 目前 TX2 在公開網路上無 API 文件，等業主向金流商索取技術文件後再實作。
 * 文件索取項目見 plan 檔「需要跟金流商索取的文件清單」。
 */
@Injectable()
export class Tx2PaymentProvider implements PaymentProvider {
  readonly providerCode = 'tx2';

  async createOrder(
    _params: CreatePaymentParams,
    _credentials: Record<string, unknown>,
  ): Promise<PaymentResult> {
    throw new NotImplementedException(
      'TX2 金流尚未實作，請聯絡管理者提供 API 文件後補上 Provider',
    );
  }

  async verifyCallback(
    _body: Record<string, unknown>,
    _headers: Record<string, string>,
    _credentials: Record<string, unknown>,
  ): Promise<PaymentVerification> {
    throw new NotImplementedException('TX2 金流尚未實作');
  }

  async queryOrder(
    _transactionId: string,
    _credentials: Record<string, unknown>,
  ): Promise<{ status: string; paidAt?: Date }> {
    throw new NotImplementedException('TX2 金流尚未實作');
  }
}
