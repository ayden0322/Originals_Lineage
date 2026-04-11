import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PaymentChannelRoute } from './entities/payment-channel-route.entity';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { UpdatePaymentRoutesDto } from './dto/update-payment-routes.dto';

type PaymentMethod = 'atm' | 'cvs' | 'credit_card';
const SUPPORTED_METHODS: PaymentMethod[] = ['atm', 'cvs', 'credit_card'];

@Injectable()
export class PaymentRouteService {
  constructor(
    @InjectRepository(PaymentChannelRoute)
    private readonly routeRepo: Repository<PaymentChannelRoute>,
    @InjectRepository(PaymentGateway)
    private readonly gatewayRepo: Repository<PaymentGateway>,
  ) {}

  /**
   * 取得指定 module 的所有付款方式路由設定
   * 若資料表還沒有對應的紀錄，會回傳 gatewayId=null 的預設項
   */
  async findByModule(moduleCode: string): Promise<
    Array<{ paymentMethod: PaymentMethod; gatewayId: string | null }>
  > {
    const existing = await this.routeRepo.find({ where: { moduleCode } });
    const map = new Map(existing.map((r) => [r.paymentMethod, r.gatewayId]));
    return SUPPORTED_METHODS.map((method) => ({
      paymentMethod: method,
      gatewayId: map.get(method) ?? null,
    }));
  }

  /**
   * 取得指定 module 對玩家公開的「可用付款方式」清單。
   * 過濾規則：
   *   1. 已設定 gatewayId（不為 null）
   *   2. 對應的 gateway 存在且 is_active=true
   * 回傳每個方式的 method、顯示用 label。
   */
  async findAvailableMethodsForPublic(
    moduleCode: string,
  ): Promise<Array<{ method: PaymentMethod; label: string }>> {
    const routes = await this.routeRepo.find({ where: { moduleCode } });
    const validRoutes = routes.filter((r) => !!r.gatewayId);
    if (validRoutes.length === 0) return [];

    const gatewayIds = validRoutes.map((r) => r.gatewayId as string);
    const gateways = await this.gatewayRepo.find({
      where: { id: In(gatewayIds), isActive: true },
    });
    const gatewayMap = new Map(gateways.map((g) => [g.id, g]));

    const labelMap: Record<PaymentMethod, string> = {
      atm: 'ATM 轉帳',
      cvs: '超商代碼',
      credit_card: '信用卡',
    };

    // channelSettings 對應的 key（creditCard 是 camelCase）
    const channelKeyMap: Record<PaymentMethod, 'atm' | 'cvs' | 'creditCard'> = {
      atm: 'atm',
      cvs: 'cvs',
      credit_card: 'creditCard',
    };

    return validRoutes
      .filter((r) => {
        const gw = gatewayMap.get(r.gatewayId as string);
        if (!gw) return false;
        const key = channelKeyMap[r.paymentMethod as PaymentMethod];
        const channel = (gw.channelSettings as Record<string, { enabled?: boolean } | undefined>)?.[key];
        // 若沒有 channelSettings 則預設視為啟用（相容舊資料）
        return channel?.enabled !== false;
      })
      .map((r) => ({
        method: r.paymentMethod as PaymentMethod,
        label: labelMap[r.paymentMethod as PaymentMethod],
      }));
  }

  /**
   * 批次更新路由設定
   * - 驗證所有 gatewayId 都存在且屬於同一個 module
   * - 用 upsert 方式（findOne → save）保證唯一鍵不衝突
   */
  async updateRoutes(
    moduleCode: string,
    dto: UpdatePaymentRoutesDto,
  ): Promise<Array<{ paymentMethod: PaymentMethod; gatewayId: string | null }>> {
    // 驗證 paymentMethod 都在白名單中
    for (const item of dto.routes) {
      if (!SUPPORTED_METHODS.includes(item.paymentMethod)) {
        throw new BadRequestException(
          `不支援的付款方式 "${item.paymentMethod}"`,
        );
      }
    }

    // 驗證所有 gatewayId 都存在於該 module（去重避免同一 gateway 對應多個付款方式時誤判）
    const gatewayIds = [
      ...new Set(
        dto.routes
          .map((r) => r.gatewayId)
          .filter((id): id is string => id !== null && id !== undefined),
      ),
    ];

    if (gatewayIds.length > 0) {
      const gateways = await this.gatewayRepo.find({
        where: { id: In(gatewayIds), moduleCode },
      });
      if (gateways.length !== gatewayIds.length) {
        throw new BadRequestException('部分 gatewayId 不存在或不屬於此模組');
      }
    }

    // 逐一 upsert
    for (const item of dto.routes) {
      const existing = await this.routeRepo.findOne({
        where: { moduleCode, paymentMethod: item.paymentMethod },
      });
      if (existing) {
        existing.gatewayId = item.gatewayId;
        await this.routeRepo.save(existing);
      } else {
        await this.routeRepo.save(
          this.routeRepo.create({
            moduleCode,
            paymentMethod: item.paymentMethod,
            gatewayId: item.gatewayId,
          }),
        );
      }
    }

    return this.findByModule(moduleCode);
  }
}
