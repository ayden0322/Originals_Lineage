import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PaymentChannelRoute } from './entities/payment-channel-route.entity';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { UpdatePaymentRoutesDto } from './dto/update-payment-routes.dto';

const SUPPORTED_METHODS: Array<'atm' | 'cvs'> = ['atm', 'cvs'];

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
    Array<{ paymentMethod: 'atm' | 'cvs'; gatewayId: string | null }>
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
  ): Promise<Array<{ method: 'atm' | 'cvs'; label: string }>> {
    const routes = await this.routeRepo.find({ where: { moduleCode } });
    const validRoutes = routes.filter((r) => !!r.gatewayId);
    if (validRoutes.length === 0) return [];

    const gatewayIds = validRoutes.map((r) => r.gatewayId as string);
    const gateways = await this.gatewayRepo.find({
      where: { id: In(gatewayIds), isActive: true },
    });
    const activeGatewayIds = new Set(gateways.map((g) => g.id));

    const labelMap: Record<'atm' | 'cvs', string> = {
      atm: 'ATM 轉帳',
      cvs: '超商代碼',
    };

    return validRoutes
      .filter((r) => activeGatewayIds.has(r.gatewayId as string))
      .map((r) => ({
        method: r.paymentMethod as 'atm' | 'cvs',
        label: labelMap[r.paymentMethod as 'atm' | 'cvs'],
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
  ): Promise<Array<{ paymentMethod: 'atm' | 'cvs'; gatewayId: string | null }>> {
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
