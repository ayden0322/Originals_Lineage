// ─── 統一支付請求 ─────────────────────────────────
export interface CreatePaymentParams {
  orderId: string;           // 內部訂單 UUID
  orderNumber: string;       // 顯示用訂單編號（EP...）
  amount: number;            // 金額（整數 TWD）
  currency?: string;         // 預設 'TWD'
  description: string;       // 交易描述
  itemName: string;          // 商品名稱（多個用 # 分隔）
  paymentMethod?: string;    // 'credit_card' | 'atm' | 'cvs' | 'all'
  customerName?: string;
  customerEmail?: string;
  returnUrl: string;         // 後端通知網址（webhook）
  orderResultUrl?: string;   // 付款完成後瀏覽器 POST 導回（經後端中繼轉 GET）
  clientBackUrl?: string;    // 前端跳轉網址（「返回商城」按鈕用）
  metadata?: Record<string, string>;
}

// ─── 統一支付結果 ─────────────────────────────────
export interface PaymentResult {
  transactionId: string;
  status: string;
  // 兩種付款跳轉模式（依金流商而定）：
  paymentUrl?: string;                    // 直接跳轉網址（Stripe 等）
  formAction?: string;                    // 表單提交網址（ECPay 等）
  formData?: Record<string, string>;      // 表單欄位
}

// ─── 統一回調結果 ─────────────────────────────────
export interface PaymentVerification {
  orderId: string;
  transactionId: string;     // 金流商交易編號
  amount: number;
  status: 'paid' | 'failed';
  paymentMethod?: string;
  paidAt?: string;
  rawData: Record<string, unknown>;
}

// ─── Adapter 介面（每家金流商實作一個）───────────
export interface PaymentProvider {
  readonly providerCode: string;

  createOrder(
    params: CreatePaymentParams,
    credentials: Record<string, unknown>,
  ): Promise<PaymentResult>;

  verifyCallback(
    body: Record<string, unknown>,
    headers: Record<string, string>,
    credentials: Record<string, unknown>,
  ): Promise<PaymentVerification>;

  queryOrder(
    transactionId: string,
    credentials: Record<string, unknown>,
  ): Promise<{ status: string; paidAt?: Date }>;
}
