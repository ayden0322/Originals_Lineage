import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { PaymentChannelRoute } from './entities/payment-channel-route.entity';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { EcpayPaymentProvider } from './providers/ecpay-payment.provider';
import { SmilepayPaymentProvider } from './providers/smilepay-payment.provider';
import { AntpayPaymentProvider } from './providers/antpay-payment.provider';
import { Tx2PaymentProvider } from './providers/tx2-payment.provider';

/**
 * 第一期支援的付款方式
 */
const SUPPORTED_PAYMENT_METHODS = ['atm', 'cvs', 'credit_card'] as const;
type SupportedPaymentMethod = (typeof SUPPORTED_PAYMENT_METHODS)[number];

@Injectable()
export class PaymentRouterService {
  private readonly logger = new Logger(PaymentRouterService.name);
  private readonly adapterMap: Map<string, PaymentProvider> = new Map();

  constructor(
    @InjectRepository(PaymentGateway)
    private readonly gatewayRepo: Repository<PaymentGateway>,
    @InjectRepository(PaymentChannelRoute)
    private readonly routeRepo: Repository<PaymentChannelRoute>,
    private readonly mockProvider: MockPaymentProvider,
    private readonly ecpayProvider: EcpayPaymentProvider,
    private readonly smilepayProvider: SmilepayPaymentProvider,
    private readonly antpayProvider: AntpayPaymentProvider,
    private readonly tx2Provider: Tx2PaymentProvider,
  ) {
    // 註冊所有可用 Adapter
    this.adapterMap.set('mock', this.mockProvider);
    this.adapterMap.set('ecpay', this.ecpayProvider);
    this.adapterMap.set('smilepay', this.smilepayProvider);
    this.adapterMap.set('antpay', this.antpayProvider);
    this.adapterMap.set('tx2', this.tx2Provider);
  }

  /**
   * 根據模組 + 付款方式，從一對一路由表選出對應的金流商
   *
   * 流程：
   * 1. 必須指定 paymentMethod（atm / cvs）
   * 2. 查 payment_channel_routes 找到對應 gatewayId
   * 3. 若未設定路由 / gatewayId 為 null / 對應 gateway 未啟用 → 拋出「該付款方式未開放」
   */
  async selectGateway(
    moduleCode: string,
    paymentMethod?: string,
  ): Promise<PaymentGateway> {
    if (!paymentMethod) {
      throw new BadRequestException('必須指定付款方式');
    }

    if (!SUPPORTED_PAYMENT_METHODS.includes(paymentMethod as SupportedPaymentMethod)) {
      throw new BadRequestException(
        `不支援的付款方式 "${paymentMethod}"，目前僅支援：${SUPPORTED_PAYMENT_METHODS.join(', ')}`,
      );
    }

    const route = await this.routeRepo.findOne({
      where: { moduleCode, paymentMethod: paymentMethod as SupportedPaymentMethod },
    });

    if (!route || !route.gatewayId) {
      throw new BadRequestException(
        `付款方式「${paymentMethod}」尚未開放，請聯絡管理者設定`,
      );
    }

    const gateway = await this.gatewayRepo.findOne({
      where: { id: route.gatewayId },
    });

    if (!gateway) {
      this.logger.warn(
        `payment_channel_routes 指向不存在的 gatewayId=${route.gatewayId}`,
      );
      throw new BadRequestException('付款設定異常，請聯絡管理者');
    }

    if (!gateway.isActive) {
      throw new BadRequestException(
        `付款方式「${paymentMethod}」對應的金流商目前停用中`,
      );
    }

    return gateway;
  }

  /**
   * 根據 providerCode 取得對應的 Adapter 實例
   */
  getProvider(providerCode: string): PaymentProvider {
    const provider = this.adapterMap.get(providerCode);
    if (!provider) {
      throw new BadRequestException(
        `Payment adapter "${providerCode}" not registered`,
      );
    }
    return provider;
  }

  /**
   * 取得所有已註冊的 Adapter 代碼
   */
  getAvailableProviderCodes(): string[] {
    return Array.from(this.adapterMap.keys());
  }
}
