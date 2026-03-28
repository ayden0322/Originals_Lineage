import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  PaymentVerification,
} from '../interfaces/payment-provider.interface';

const SMILEPAY_TEST_URL =
  'https://ssl.smse.com.tw/ezpos_test/mtmk_utf.asp';
const SMILEPAY_PROD_URL =
  'https://ssl.smse.com.tw/ezpos/mtmk_utf.asp';

@Injectable()
export class SmilepayPaymentProvider implements PaymentProvider {
  readonly providerCode = 'smilepay';
  private readonly logger = new Logger(SmilepayPaymentProvider.name);

  async createOrder(
    params: CreatePaymentParams,
    credentials: Record<string, unknown>,
  ): Promise<PaymentResult> {
    const dcvc = credentials.dcvc as string;
    const rvg2c = credentials.rvg2c as string;
    const isSandbox = credentials.isSandbox !== false;

    const smilePayParams: Record<string, string> = {
      Dcvc: dcvc,
      Rvg2c: rvg2c,
      Amount: String(Math.round(params.amount)),
      Data_id: params.orderNumber,
      Od_sob: params.itemName.slice(0, 200),
      Pur_name: params.customerName || '',
      Email: params.customerEmail || '',
      Remark: params.description.slice(0, 200),
      Roturl: params.returnUrl,
      Roturl_status: 'RrotUrl_status',
      Pay_zg: this.mapPaymentMethod(params.paymentMethod),
      Moneytype: 'TW',
    };

    const formAction = isSandbox ? SMILEPAY_TEST_URL : SMILEPAY_PROD_URL;

    this.logger.log(
      `SmilePay order created: ${params.orderNumber}, amount: ${params.amount}, sandbox: ${isSandbox}`,
    );

    return {
      transactionId: params.orderNumber,
      status: 'pending',
      formAction,
      formData: smilePayParams,
    };
  }

  async verifyCallback(
    body: Record<string, unknown>,
    headers: Record<string, string>,
    credentials: Record<string, unknown>,
  ): Promise<PaymentVerification> {
    const verifyKey = credentials.verifyKey as string;
    const isSandbox = credentials.isSandbox !== false;

    const responseId = String(body.Response_id || '');
    const smseid = String(body.Smseid || '');
    const dataId = String(body.Data_id || '');
    const amount = Number(body.Amount) || 0;
    const midSmilepay = String(body.Mid_smilepay || '');
    const classif = String(body.Classif || '');

    // 驗證 Mid_smilepay 校驗碼
    const isValid = this.verifyMidSmilepay(
      verifyKey,
      amount,
      smseid,
      midSmilepay,
      isSandbox,
    );

    if (!isValid) {
      this.logger.warn(
        `SmilePay Mid_smilepay verification failed! received: ${midSmilepay}, ` +
          `Data_id: ${dataId}, Smseid: ${smseid}`,
      );
      return {
        orderId: '',
        transactionId: smseid,
        amount,
        status: 'failed',
        rawData: body,
      };
    }

    const isPaid = responseId === '1';

    this.logger.log(
      `SmilePay callback verified: Data_id=${dataId}, Smseid=${smseid}, ` +
        `Response_id=${responseId}, isPaid=${isPaid}, Classif=${classif}`,
    );

    return {
      orderId: '', // 由 Service 層透過 Data_id 查找 orderId
      transactionId: smseid,
      amount,
      status: isPaid ? 'paid' : 'failed',
      paymentMethod: this.mapClassifToMethod(classif),
      paidAt: isPaid
        ? `${body.Process_date || ''} ${body.Process_time || ''}`.trim() || undefined
        : undefined,
      rawData: body,
    };
  }

  async queryOrder(
    transactionId: string,
    credentials: Record<string, unknown>,
  ): Promise<{ status: string; paidAt?: Date }> {
    this.logger.warn(
      `SmilePay queryOrder not implemented yet. transactionId: ${transactionId}`,
    );
    return { status: 'unknown' };
  }

  // ─── Mid_smilepay 校驗碼驗證 ───────────────────────────────

  private verifyMidSmilepay(
    verifyKey: string,
    amount: number,
    smseid: string,
    receivedMid: string,
    isSandbox: boolean,
  ): boolean {
    // 測試模式：Mid_smilepay 為 0，直接通過
    if (isSandbox) {
      return true;
    }

    // 1. 組合字串：Verify_key + 金額補零至 8 位 + Smseid 末 4 碼
    const formattedAmount = String(amount).padStart(8, '0');
    const last4 = smseid.slice(-4);
    const combined = verifyKey + formattedAmount + last4;

    // 2. 遍歷每個字元，計算校驗碼
    //    1-indexed 奇數位 × 9 + 1-indexed 偶數位 × 3
    //    (0-indexed: even × 9, odd × 3)
    let sum = 0;
    for (let i = 0; i < combined.length; i++) {
      const code = combined.charCodeAt(i);
      const val = code >= 48 && code <= 57 ? code - 48 : code;

      if (i % 2 === 0) {
        sum += val * 9; // 0-indexed even = 1-indexed odd
      } else {
        sum += val * 3; // 0-indexed odd = 1-indexed even
      }
    }

    return sum === Number(receivedMid);
  }

  // ─── 付款方式映射 ─────────────────────────────────────────

  private mapPaymentMethod(method?: string): string {
    switch (method) {
      case 'credit_card':
        return '1';
      case 'atm':
        return '2';
      case 'cvs':
        return '3';
      default:
        return '2'; // 預設 ATM
    }
  }

  private mapClassifToMethod(classif: string): string {
    switch (classif) {
      case 'A':
      case 'D':
        return 'credit_card';
      case 'B':
        return 'atm';
      case 'C':
        return 'cvs';
      default:
        return classif;
    }
  }
}
