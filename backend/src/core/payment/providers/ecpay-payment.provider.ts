import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  PaymentVerification,
} from '../interfaces/payment-provider.interface';

const ECPAY_STAGE_URL =
  'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
const ECPAY_PROD_URL =
  'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

@Injectable()
export class EcpayPaymentProvider implements PaymentProvider {
  readonly providerCode = 'ecpay';
  private readonly logger = new Logger(EcpayPaymentProvider.name);

  async createOrder(
    params: CreatePaymentParams,
    credentials: Record<string, unknown>,
  ): Promise<PaymentResult> {
    const merchantId = credentials.merchantId as string;
    const hashKey = credentials.hashKey as string;
    const hashIv = credentials.hashIv as string;
    const isSandbox = credentials.isSandbox !== false;

    // ECPay MerchantTradeNo 限制 20 字元，只能英數
    const tradeNo = params.orderNumber.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);

    const tradeDate = this.formatTradeDate(new Date());

    const ecpayParams: Record<string, string> = {
      MerchantID: merchantId,
      MerchantTradeNo: tradeNo,
      MerchantTradeDate: tradeDate,
      PaymentType: 'aio',
      TotalAmount: String(Math.round(params.amount)),
      TradeDesc: this.urlEncodeDotNet(params.description).slice(0, 200),
      ItemName: params.itemName.slice(0, 200),
      ReturnURL: params.returnUrl,
      ChoosePayment: this.mapPaymentMethod(params.paymentMethod),
      EncryptType: '1', // SHA256
    };

    // OrderResultURL：付款完成後瀏覽器 POST 導回（經後端中繼轉 GET）
    if (params.orderResultUrl) {
      ecpayParams.OrderResultURL = params.orderResultUrl;
    }
    // ClientBackURL：ECPay 頁面上「返回商店」按鈕（GET 跳轉）
    if (params.clientBackUrl) {
      ecpayParams.ClientBackURL = params.clientBackUrl;
    }

    // 自訂欄位：存放內部訂單 ID，回調時可以對應
    ecpayParams.CustomField1 = params.orderId;

    // 計算 CheckMacValue
    ecpayParams.CheckMacValue = this.generateCheckMacValue(
      ecpayParams,
      hashKey,
      hashIv,
    );

    const formAction = isSandbox ? ECPAY_STAGE_URL : ECPAY_PROD_URL;

    this.logger.log(
      `ECPay order created: ${tradeNo}, amount: ${params.amount}, sandbox: ${isSandbox}`,
    );

    return {
      transactionId: tradeNo,
      status: 'pending',
      formAction,
      formData: ecpayParams,
    };
  }

  async verifyCallback(
    body: Record<string, unknown>,
    headers: Record<string, string>,
    credentials: Record<string, unknown>,
  ): Promise<PaymentVerification> {
    const hashKey = credentials.hashKey as string;
    const hashIv = credentials.hashIv as string;

    // 取出 ECPay 回傳的 CheckMacValue
    const receivedMac = body.CheckMacValue as string;

    // 從 body 中取出除 CheckMacValue 外的所有參數，重新計算
    const paramsToVerify: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (key !== 'CheckMacValue') {
        paramsToVerify[key] = String(value);
      }
    }

    const calculatedMac = this.generateCheckMacValue(
      paramsToVerify,
      hashKey,
      hashIv,
    );

    if (calculatedMac !== receivedMac) {
      this.logger.warn(
        `ECPay CheckMacValue mismatch! received: ${receivedMac}, calculated: ${calculatedMac}`,
      );
      return {
        orderId: (body.CustomField1 as string) || '',
        transactionId: (body.TradeNo as string) || '',
        amount: Number(body.TradeAmt) || 0,
        status: 'failed',
        rawData: body,
      };
    }

    const rtnCode = String(body.RtnCode);
    const isPaid = rtnCode === '1';

    this.logger.log(
      `ECPay callback verified: TradeNo=${body.TradeNo}, RtnCode=${rtnCode}, isPaid=${isPaid}`,
    );

    return {
      orderId: (body.CustomField1 as string) || '',
      transactionId: (body.TradeNo as string) || '',
      amount: Number(body.TradeAmt) || 0,
      status: isPaid ? 'paid' : 'failed',
      paymentMethod: (body.PaymentType as string) || undefined,
      paidAt: isPaid ? (body.PaymentDate as string) || undefined : undefined,
      rawData: body,
    };
  }

  async queryOrder(
    transactionId: string,
    credentials: Record<string, unknown>,
  ): Promise<{ status: string; paidAt?: Date }> {
    // ECPay 的訂單查詢需要另外的 API，這裡先做基本回傳
    // 實際上線後可串接 ECPay TradeInfo API
    this.logger.warn(
      `ECPay queryOrder not fully implemented yet. transactionId: ${transactionId}`,
    );
    return {
      status: 'unknown',
    };
  }

  // ─── CheckMacValue 計算 ──────────────────────────────────────

  generateCheckMacValue(
    params: Record<string, string>,
    hashKey: string,
    hashIv: string,
  ): string {
    // 1. 參數按 key 排序（不分大小寫）
    const sortedKeys = Object.keys(params).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );

    // 2. 組成 query string
    const sortedParams = sortedKeys
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    // 3. 前後加上 HashKey 和 HashIV
    const raw = `HashKey=${hashKey}&${sortedParams}&HashIV=${hashIv}`;

    // 4. URL 編碼（.NET 規則）
    const encoded = this.urlEncodeDotNet(raw);

    // 5. 轉小寫
    const lowered = encoded.toLowerCase();

    // 6. SHA256 → 轉大寫
    const hash = createHash('sha256').update(lowered).digest('hex');
    return hash.toUpperCase();
  }

  // ─── .NET URL 編碼 ───────────────────────────────────────────

  private urlEncodeDotNet(value: string): string {
    // 先做標準 URL 編碼
    let encoded = encodeURIComponent(value);

    // .NET 特殊規則：這些字元要還原為字面值
    encoded = encoded
      .replace(/%2d/gi, '-')
      .replace(/%5f/gi, '_')
      .replace(/%2e/gi, '.')
      .replace(/%21/gi, '!')
      .replace(/%2a/gi, '*')
      .replace(/%28/gi, '(')
      .replace(/%29/gi, ')')
      .replace(/%20/gi, '+');

    return encoded;
  }

  // ─── 日期格式化 ─────────────────────────────────────────────

  private formatTradeDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${min}:${s}`;
  }

  // ─── 付款方式映射 ───────────────────────────────────────────

  private mapPaymentMethod(method?: string): string {
    switch (method) {
      case 'credit_card':
        return 'Credit';
      case 'atm':
        return 'ATM';
      case 'cvs':
        return 'CVS';
      default:
        return 'ALL';
    }
  }
}
