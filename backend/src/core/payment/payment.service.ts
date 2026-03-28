import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentRouterService } from './payment-router.service';
import { PaymentGatewayService } from './payment-gateway.service';
import {
  CreatePaymentParams,
  PaymentResult,
} from './interfaces/payment-provider.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly txRepo: Repository<PaymentTransaction>,
    private readonly routerService: PaymentRouterService,
    private readonly gatewayService: PaymentGatewayService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 建立付款交易
   * 1. 透過 PaymentRouter 找到最適合的通道
   * 2. 用該通道的 credentials 呼叫對應 Adapter
   * 3. 回傳含 formAction/paymentUrl 的結果
   */
  async createTransaction(
    moduleCode: string,
    orderId: string,
    orderNumber: string,
    amount: number,
    itemName: string,
    description: string,
    paymentMethod?: string,
    customerEmail?: string,
  ): Promise<PaymentResult> {
    // 1. 選擇通道
    const gateway = await this.routerService.selectGateway(
      moduleCode,
      paymentMethod,
    );

    // 2. 取得 Adapter
    const provider = this.routerService.getProvider(gateway.providerCode);

    // 3. 建立 DB 記錄
    const tx = this.txRepo.create({
      moduleCode,
      orderId,
      amount,
      providerName: gateway.providerCode,
      status: 'pending',
    });
    await this.txRepo.save(tx);

    // 4. 組裝統一參數
    const backendPort = this.configService.get('BACKEND_PORT', '4000');
    const backendHost = this.configService.get(
      'BACKEND_PUBLIC_URL',
      `http://localhost:${backendPort}`,
    );
    const frontendPort = this.configService.get('FRONTEND_PORT', '3000');
    const frontendHost = this.configService.get(
      'FRONTEND_PUBLIC_URL',
      `http://localhost:${frontendPort}`,
    );

    const params: CreatePaymentParams = {
      orderId,
      orderNumber,
      amount,
      description,
      itemName,
      paymentMethod,
      customerEmail,
      returnUrl: `${backendHost}/api/payment/notify/${gateway.providerCode}`,
      orderResultUrl: gateway.providerCode === 'ecpay'
        ? `${backendHost}/api/payment/ecpay/return`
        : undefined,
      clientBackUrl: `${frontendHost}/public/shop`,
    };

    // 5. 呼叫 Adapter
    const result = await provider.createOrder(params, {
      ...gateway.credentials,
      isSandbox: gateway.isSandbox,
    });

    // 6. 更新 DB
    tx.providerTransactionId = result.transactionId;
    tx.status = result.status;
    await this.txRepo.save(tx);

    this.logger.log(
      `Payment transaction created: ${tx.id}, provider: ${gateway.providerCode}, ` +
        `transactionId: ${result.transactionId}`,
    );

    return result;
  }

  /**
   * 處理金流回調
   * 1. 根據 providerCode 找到 Adapter
   * 2. 從回調 body 解析出 orderId
   * 3. 驗證簽章 + 取得付款結果
   * 4. 更新交易狀態
   * 5. 發送 payment.paid 事件
   */
  async handleCallback(
    providerCode: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<{ success: boolean; message: string }> {
    const provider = this.routerService.getProvider(providerCode);

    // 從 body 中先提取 orderId 以找到對應的 gateway
    // ECPay: CustomField1 存了 orderId
    // SmilePay: Data_id 存了 orderNumber → 用 providerTransactionId 反查
    // Mock: body.orderId
    let orderId: string;
    let tx: PaymentTransaction | null = null;

    if (providerCode === 'ecpay') {
      orderId = (body.CustomField1 as string) || '';
      tx = await this.txRepo.findOne({
        where: { orderId, providerName: providerCode },
      });
    } else if (providerCode === 'smilepay') {
      const dataId = (body.Data_id as string) || '';
      tx = await this.txRepo.findOne({
        where: { providerTransactionId: dataId, providerName: 'smilepay' },
      });
      orderId = tx?.orderId || '';
    } else {
      orderId = (body.orderId as string) || '';
      tx = await this.txRepo.findOne({
        where: { orderId, providerName: providerCode },
      });
    }

    if (!tx) {
      this.logger.warn(
        `Transaction not found for provider: ${providerCode}, body keys: ${Object.keys(body).join(',')}`,
      );
      throw new BadRequestException('Transaction not found');
    }

    // 找到對應的 gateway 取得 credentials
    const gateway = await this.gatewayService.findByProviderCode(
      tx.moduleCode,
      providerCode,
    );

    if (!gateway) {
      throw new BadRequestException('Gateway configuration not found');
    }

    // 呼叫 Adapter 驗證
    const verification = await provider.verifyCallback(body, headers, {
      ...gateway.credentials,
      isSandbox: gateway.isSandbox,
    });

    // 更新交易狀態
    tx.status = verification.status;
    tx.callbackData = verification.rawData;
    if (verification.paymentMethod) {
      tx.paymentMethod = verification.paymentMethod;
    }
    if (verification.status === 'paid') {
      tx.paidAt = verification.paidAt ? new Date(verification.paidAt) : new Date();
    }
    await this.txRepo.save(tx);

    this.logger.log(
      `Payment callback processed: ${tx.id}, status: ${verification.status}`,
    );

    // 發送付款完成事件
    if (verification.status === 'paid') {
      this.eventEmitter.emit('payment.paid', {
        orderId: tx.orderId,
        moduleCode: tx.moduleCode,
        transactionId: tx.providerTransactionId,
        amount: tx.amount,
        providerCode,
      });
    }

    return { success: true, message: '1|OK' };
  }

  async findByOrderId(orderId: string): Promise<PaymentTransaction | null> {
    return this.txRepo.findOne({ where: { orderId } });
  }

  async findAll(
    page = 1,
    limit = 20,
    moduleCode?: string,
  ): Promise<{
    items: PaymentTransaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where: Record<string, unknown> = {};
    if (moduleCode) {
      where.moduleCode = moduleCode;
    }

    const [items, total] = await this.txRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { items, total, page, limit };
  }
}
