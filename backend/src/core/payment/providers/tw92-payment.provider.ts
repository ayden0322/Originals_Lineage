import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  PaymentVerification,
} from '../interfaces/payment-provider.interface';

const TW92_BASE_URL = 'https://twpay-tw92.max-cloud.cc';

// tw92 TransactionType 對應系統 paymentMethod
// 本次整合只啟用：atm→7（虛擬帳戶）、cvs→3（超商代碼）
// credit_card 不由 tw92 處理（tw92 雖支援 Type 4，但依需求不啟用）
const TX_TYPE_VIRTUAL_ACCOUNT = 7;
const TX_TYPE_CVS = 3;

// 訂單狀態碼：1=處理中 2=進行中 3=成功 4=取消 5=提交完成 6=爭議 7=延遲下發
const TW92_STATUS_PAID = '3';

@Injectable()
export class Tw92PaymentProvider implements PaymentProvider {
  readonly providerCode = 'tw92';
  private readonly logger = new Logger(Tw92PaymentProvider.name);

  async createOrder(
    params: CreatePaymentParams,
    credentials: Record<string, unknown>,
  ): Promise<PaymentResult> {
    const sn = String(credentials.sn || '');
    const apiKey = String(credentials.apiKey || '');
    const publicKey = String(credentials.publicKey || '');

    if (!sn || !apiKey || !publicKey) {
      throw new Error('tw92 credentials 缺少 sn / apiKey / publicKey');
    }

    const txType = this.mapPaymentMethodToType(params.paymentMethod);

    const payload: Record<string, unknown> = {
      TransactionType: txType,
      TransactionAmount: Math.round(params.amount),
      TransactionCode: params.orderNumber.slice(0, 32),
      Callback: params.returnUrl,
    };

    if (txType === TX_TYPE_CVS) {
      payload.TransactionAccountName = (params.customerName || '買家').slice(0, 32);
    }

    const payloadJson = JSON.stringify(payload);
    const encrypted = this.encrypt(payloadJson, publicKey, apiKey);

    const body = new URLSearchParams({ data: encrypted }).toString();
    const url = `${TW92_BASE_URL}/api/order/recharge?sn=${encodeURIComponent(sn)}`;

    // ─── 除錯用完整 Request dump（可貼給 tw92 客服）───
    this.logger.log(
      `[tw92 REQUEST DUMP]\n` +
        `URL: ${url}\n` +
        `Method: POST\n` +
        `Headers: Authorization=${apiKey}, Content-Type=application/x-www-form-urlencoded\n` +
        `Body (plaintext before encryption): ${payloadJson}\n` +
        `Body (actual encrypted data sent): data=${encrypted}`,
    );

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const responseText = await res.text();
    // ─── 除錯用完整 Response dump（可貼給 tw92 客服）───
    this.logger.log(
      `[tw92 RESPONSE DUMP]\n` +
        `HTTP Status: ${res.status}\n` +
        `Body: ${responseText}`,
    );

    let json: {
      status: boolean;
      data?: Record<string, unknown>;
      error?: string;
    };
    try {
      json = JSON.parse(responseText);
    } catch {
      this.logger.error(`tw92 response 非合法 JSON: ${responseText}`);
      throw new Error(`tw92 回應非合法 JSON：${responseText.slice(0, 200)}`);
    }

    if (!json.status || !json.data) {
      this.logger.error(
        `tw92 createOrder 失敗 orderNumber=${params.orderNumber} error=${json.error}`,
      );
      throw new Error(`tw92 下單失敗：${json.error || 'unknown error'}`);
    }

    const data = json.data;
    const serialNumber = String(data.SerialNumber || '');

    this.logger.log(
      `tw92 order created: ${params.orderNumber}, type=${txType}, SerialNumber=${serialNumber}`,
    );

    // providerTransactionId 用 orderNumber（= TransactionCode）以利 callback 反查；
    // tw92 /api/order/query 亦支援用 TransactionCode 查詢。
    const transactionId = params.orderNumber;

    // Type 7 虛擬帳戶：回傳銀行帳號資訊
    if (txType === TX_TYPE_VIRTUAL_ACCOUNT) {
      return {
        transactionId,
        status: 'pending',
        virtualAccount: {
          bankNumber: String(data.BankNumber || ''),
          bankName: data.BankName ? String(data.BankName) : undefined,
          accountNumber: String(data.AccountNumber || ''),
          amount: Number(data.TransactionAmount) || Math.round(params.amount),
          expireDate: data.ExpireDate ? String(data.ExpireDate) : undefined,
        },
      };
    }

    // Type 3 超商：回傳付款連結（PaymentUrl 優先，其次 ShortUrl、PaymentPageUrl）
    const paymentUrl =
      (data.PaymentUrl as string) ||
      (data.ShortUrl as string) ||
      (data.PaymentPageUrl as string) ||
      undefined;

    return {
      transactionId,
      status: 'pending',
      paymentUrl,
    };
  }

  async verifyCallback(
    body: Record<string, unknown>,
    _headers: Record<string, string>,
    credentials: Record<string, unknown>,
  ): Promise<PaymentVerification> {
    const apiKey = String(credentials.apiKey || '');
    const publicKey = String(credentials.publicKey || '');
    const encData = String(body.data || '');

    if (!encData) {
      this.logger.warn('tw92 callback 缺少 data 欄位');
      return {
        orderId: '',
        transactionId: '',
        amount: 0,
        status: 'failed',
        rawData: body,
      };
    }

    let decoded: Record<string, unknown>;
    try {
      const plaintext = this.decrypt(encData, publicKey, apiKey);
      decoded = JSON.parse(plaintext);
    } catch (err) {
      this.logger.error(`tw92 callback 解密失敗: ${(err as Error).message}`);
      return {
        orderId: '',
        transactionId: '',
        amount: 0,
        status: 'failed',
        rawData: body,
      };
    }

    const status = String(decoded.Status || '');
    const isPaid = status === TW92_STATUS_PAID;
    const serialNumber = String(decoded.SerialNumber || '');
    const transactionCode = String(decoded.TransactionCode || '');
    const amount = Number(decoded.TransactionAmount) || 0;

    this.logger.log(
      `tw92 callback: SerialNumber=${serialNumber}, TransactionCode=${transactionCode}, Status=${status}, isPaid=${isPaid}`,
    );

    return {
      orderId: '', // 由 Service 層透過 TransactionCode 反查
      transactionId: serialNumber,
      amount,
      status: isPaid ? 'paid' : 'failed',
      paidAt: isPaid && decoded.CompleteTime ? String(decoded.CompleteTime) : undefined,
      rawData: { ...body, _decoded: decoded },
    };
  }

  async queryOrder(
    transactionId: string,
    credentials: Record<string, unknown>,
  ): Promise<{ status: string; paidAt?: Date }> {
    const sn = String(credentials.sn || '');
    const apiKey = String(credentials.apiKey || '');
    const publicKey = String(credentials.publicKey || '');

    if (!sn || !apiKey || !publicKey) {
      return { status: 'unknown' };
    }

    // providerTransactionId 實際存的是 TransactionCode（= orderNumber）
    const payload = { OrderType: 'recharge', TransactionCode: transactionId };
    const encrypted = this.encrypt(JSON.stringify(payload), publicKey, apiKey);
    const body = new URLSearchParams({ data: encrypted }).toString();
    const url = `${TW92_BASE_URL}/api/order/query?sn=${encodeURIComponent(sn)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const json = (await res.json()) as {
      status: boolean;
      data?: Record<string, unknown>;
    };

    if (!json.status || !json.data) {
      return { status: 'unknown' };
    }

    const tw92Status = String(json.data.Status || '');
    const isPaid = tw92Status === TW92_STATUS_PAID;
    return {
      status: isPaid ? 'paid' : tw92Status,
      paidAt: isPaid && json.data.CompleteTime
        ? new Date(String(json.data.CompleteTime))
        : undefined,
    };
  }

  // ─── 工具函式 ───────────────────────────────────────────────

  private mapPaymentMethodToType(method?: string): number {
    switch (method) {
      case 'cvs':
        return TX_TYPE_CVS;
      case 'atm':
      default:
        return TX_TYPE_VIRTUAL_ACCOUNT;
    }
  }

  // AES-256-CBC 加密（tw92 採 double base64）
  // Key = sha256(publicKey) 前 32 byte（hex ASCII）
  // IV  = sha256(apiKey) 前 16 byte（hex ASCII）
  // 輸出 = base64( base64(ciphertext) )  ← 與 PHP openssl_encrypt + base64_encode 行為相容
  private encrypt(plaintext: string, publicKey: string, apiKey: string): string {
    const { key, iv } = this.deriveKeyIv(publicKey, apiKey);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const b64once = encrypted.toString('base64');
    return Buffer.from(b64once, 'utf8').toString('base64');
  }

  private decrypt(encryptedBase64: string, publicKey: string, apiKey: string): string {
    const { key, iv } = this.deriveKeyIv(publicKey, apiKey);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    // 先 base64 解一次拿到「內層 base64 字串」，再 base64 解一次拿到 ciphertext
    const innerB64 = Buffer.from(encryptedBase64, 'base64').toString('utf8');
    const encrypted = Buffer.from(innerB64, 'base64');
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private deriveKeyIv(publicKey: string, apiKey: string): { key: Buffer; iv: Buffer } {
    const keyHex = crypto.createHash('sha256').update(publicKey, 'utf8').digest('hex');
    const ivHex = crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');
    // 取 hex 字串的前 32 / 16 字元當 ASCII byte（符合 PHP substr(hash('sha256', ...), 0, 16) 行為）
    const key = Buffer.from(keyHex.slice(0, 32), 'utf8');
    const iv = Buffer.from(ivHex.slice(0, 16), 'utf8');
    return { key, iv };
  }
}
