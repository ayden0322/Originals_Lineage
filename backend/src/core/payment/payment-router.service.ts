import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { EcpayPaymentProvider } from './providers/ecpay-payment.provider';
import { SmilepayPaymentProvider } from './providers/smilepay-payment.provider';

@Injectable()
export class PaymentRouterService {
  private readonly logger = new Logger(PaymentRouterService.name);
  private readonly adapterMap: Map<string, PaymentProvider> = new Map();

  constructor(
    @InjectRepository(PaymentGateway)
    private readonly gatewayRepo: Repository<PaymentGateway>,
    private readonly mockProvider: MockPaymentProvider,
    private readonly ecpayProvider: EcpayPaymentProvider,
    private readonly smilepayProvider: SmilepayPaymentProvider,
  ) {
    // 註冊所有可用 Adapter
    this.adapterMap.set('mock', this.mockProvider);
    this.adapterMap.set('ecpay', this.ecpayProvider);
    this.adapterMap.set('smilepay', this.smilepayProvider);
  }

  /**
   * 根據模組 + 付款方式，找到最適合的啟用通道
   */
  async selectGateway(
    moduleCode: string,
    paymentMethod?: string,
  ): Promise<PaymentGateway> {
    const qb = this.gatewayRepo
      .createQueryBuilder('gw')
      .where('gw.module_code = :moduleCode', { moduleCode })
      .andWhere('gw.is_active = :active', { active: true })
      .orderBy('gw.priority', 'DESC');

    const gateways = await qb.getMany();

    if (gateways.length === 0) {
      throw new BadRequestException(
        `No active payment gateway found for module "${moduleCode}"`,
      );
    }

    // 如果指定了付款方式，過濾支援該方式的通道
    if (paymentMethod) {
      const matched = gateways.find((gw) =>
        gw.supportedMethods.includes(paymentMethod) ||
        gw.supportedMethods.includes('all'),
      );
      if (matched) return matched;
    }

    // 回傳優先順序最高的通道
    return gateways[0];
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
