import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { MemberBinding } from '../../member/entities/member-binding.entity';
import { PaymentService } from '../../../../core/payment/payment.service';
import { LineService } from '../../../../core/line/line.service';
import { GameDbService } from '../../game-db/game-db.service';
import { Agent } from '../../commission/entities/agent.entity';
import { PlayerAttribution } from '../../commission/entities/player-attribution.entity';

const MODULE_CODE = 'originals-lineage';

interface OrderEventPayload {
  orderId: string;
  moduleCode: string;
}

interface DeliveryEntry {
  type?: string;
  count?: number;
  itemName?: string;
  quantity?: number;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  atm: 'ATM 轉帳',
  cvs: '超商代碼繳費',
  credit_card: '信用卡',
  all: '信用卡 / ATM / 超商',
};

/**
 * 監聽訂單發貨事件，把儲值通知推到管理 LINE 群組。
 * - order.delivered → 綠色成功訊息
 * - order.delivery_failed → 紅色告警訊息
 *
 * 設計原則：所有錯誤吃掉、只 log，不影響主流程。
 */
@Injectable()
export class OrderLineNotifyListener {
  private readonly logger = new Logger(OrderLineNotifyListener.name);

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(MemberBinding)
    private readonly memberBindingRepo: Repository<MemberBinding>,
    @InjectRepository(PlayerAttribution)
    private readonly attributionRepo: Repository<PlayerAttribution>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly paymentService: PaymentService,
    private readonly lineService: LineService,
    private readonly gameDbService: GameDbService,
  ) {}

  @OnEvent('order.delivered', { async: true, promisify: true })
  async onDelivered(payload: OrderEventPayload) {
    if (payload.moduleCode !== MODULE_CODE) return;
    try {
      await this.notifyDelivered(payload.orderId);
    } catch (err) {
      this.logger.error(
        `推送發貨成功訊息失敗 order=${payload.orderId}: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent('order.delivery_failed', { async: true, promisify: true })
  async onDeliveryFailed(payload: OrderEventPayload) {
    if (payload.moduleCode !== MODULE_CODE) return;
    try {
      await this.notifyFailed(payload.orderId);
    } catch (err) {
      this.logger.error(
        `推送發貨失敗訊息失敗 order=${payload.orderId}: ${(err as Error).message}`,
      );
    }
  }

  // ─── 成功訊息 ────────────────────────────────────────────────

  private async notifyDelivered(orderId: string) {
    const ctx = await this.loadOrderContext(orderId);
    if (!ctx) return;

    const itemSummary = this.summarizeItems(ctx.items, ctx.products, ctx.deliveryEntries);
    const paymentMethodLabel = this.paymentMethodLabel(ctx.paymentMethod, ctx.providerCode);
    const orderCount = await this.countMemberPaidOrders(ctx.order.memberBindingId);
    const todayStats = await this.todayStats();
    const agentLabel = await this.agentLabel(ctx.binding?.websiteAccountId);

    const text =
      `💰 儲值到帳，訂單編號：${ctx.order.orderNumber}\n` +
      `\n` +
      `玩家：${ctx.binding?.gameAccountName ?? '(未綁定)'}\n` +
      `血盟：${ctx.clanName ?? '無血盟'}\n` +
      `商品：${itemSummary}\n` +
      `金額：NT$${formatNumber(ctx.order.totalAmount)}\n` +
      `付款方式：${paymentMethodLabel}\n` +
      `✅ 已自動發貨\n` +
      (agentLabel ? `推薦人：${agentLabel}\n` : '') +
      `\n` +
      `${orderCount === 1 ? '🌟 該玩家首儲' : `累計第 ${orderCount} 筆`}\n` +
      `\n` +
      `今日流水 NT$${formatNumber(todayStats.amount)}（${todayStats.count} 筆）\n` +
      `\n` +
      `🕐 ${formatTime(new Date())}`;

    const result = await this.lineService.broadcastToNotifyGroups(
      MODULE_CODE,
      'recharge',
      [{ type: 'text', text }],
    );
    this.logger.log(
      `[delivered] order=${ctx.order.orderNumber} 推送 ok=${result.ok} failed=${result.failed}`,
    );
  }

  // ─── 失敗訊息 ────────────────────────────────────────────────

  private async notifyFailed(orderId: string) {
    const ctx = await this.loadOrderContext(orderId);
    if (!ctx) return;

    const details = ctx.order.deliveryDetails as Record<string, unknown> | null;
    const errorMsg =
      (details && typeof details.error === 'string' && details.error) ||
      '未知錯誤';
    const attempts =
      (details && typeof details.attempts === 'number' && details.attempts) || 0;

    const text =
      `🚨 儲值發貨異常，訂單編號：${ctx.order.orderNumber}\n` +
      `\n` +
      `玩家：${ctx.binding?.gameAccountName ?? '(未綁定)'}\n` +
      `血盟：${ctx.clanName ?? '無血盟'}\n` +
      `金額：NT$${formatNumber(ctx.order.totalAmount)}（已收款 ✅）\n` +
      `❌ 發貨失敗：${errorMsg}\n` +
      (attempts ? `已重試 ${attempts} 次（共 ~3 分鐘）\n` : '') +
      `\n` +
      `請至後台手動補發 → /admin/orders/${ctx.order.id}\n` +
      `\n` +
      `🕐 ${formatTime(new Date())}`;

    const result = await this.lineService.broadcastToNotifyGroups(
      MODULE_CODE,
      'recharge',
      [{ type: 'text', text }],
    );
    this.logger.log(
      `[failed] order=${ctx.order.orderNumber} 推送 ok=${result.ok} failed=${result.failed}`,
    );
  }

  // ─── 資料載入 ────────────────────────────────────────────────

  private async loadOrderContext(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) {
      this.logger.warn(`找不到訂單 ${orderId}`);
      return null;
    }

    const binding = order.memberBindingId
      ? await this.memberBindingRepo.findOne({
          where: { id: order.memberBindingId },
        })
      : null;

    const items = order.items || [];
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const products = productIds.length
      ? await this.productRepo
          .createQueryBuilder('p')
          .where('p.id IN (:...ids)', { ids: productIds })
          .getMany()
      : [];

    const tx = await this.paymentService
      .findByOrderId(order.id)
      .catch(() => null);

    const deliveryEntries = (
      (order.deliveryDetails as Record<string, unknown> | null)?.entries as
        | DeliveryEntry[]
        | undefined
    ) || [];

    // 血盟 snapshot：從遊戲庫即時查；查不到 / 未連線都回 null（不阻斷通知）
    let clanName: string | null = null;
    if (binding?.gameAccountName) {
      try {
        const map = await this.gameDbService.findCharacterClanByAccounts([
          binding.gameAccountName,
        ]);
        clanName = map.get(binding.gameAccountName)?.clanName ?? null;
      } catch (err) {
        this.logger.warn(`查血盟失敗：${(err as Error).message}`);
      }
    }

    return {
      order,
      binding,
      items,
      products,
      deliveryEntries,
      paymentMethod: tx?.paymentMethod ?? null,
      providerCode: tx?.providerName ?? null,
      clanName,
    };
  }

  /**
   * 用 deliveryDetails.entries 裡的 count 為主（精準）；
   * 若沒有（失敗情境通常沒這個），fallback 用 order_items 的 quantity × product。
   */
  private summarizeItems(
    items: OrderItem[],
    products: Product[],
    deliveryEntries: DeliveryEntry[],
  ): string {
    const productMap = new Map(products.map((p) => [p.id, p]));

    if (deliveryEntries.length) {
      const parts: string[] = [];
      let diamondTotal = 0;
      for (const entry of deliveryEntries) {
        if (entry.type === 'diamond' && typeof entry.count === 'number') {
          diamondTotal += entry.count;
        } else if (entry.itemName) {
          parts.push(`${entry.itemName} ×${entry.quantity ?? 1}`);
        }
      }
      // 鑽石類訊息範例：「四海銀票 ×1,200」（合併鑽石總數，禮包/月卡個別列）
      if (diamondTotal > 0) {
        const diamondName = this.findDiamondProductName(items, productMap) || '銀票';
        parts.unshift(`${diamondName} ×${formatNumber(diamondTotal)}`);
      }
      return parts.join('、') || '(無)';
    }

    // fallback：用 order_items
    return (
      items
        .map((i) => {
          const p = productMap.get(i.productId);
          return p ? `${p.name} ×${i.quantity}` : `(商品 ${i.productId})`;
        })
        .join('、') || '(無)'
    );
  }

  private findDiamondProductName(
    items: OrderItem[],
    productMap: Map<string, Product>,
  ): string | null {
    for (const i of items) {
      const p = productMap.get(i.productId);
      if (p?.category === 'diamond') return p.name;
    }
    return null;
  }

  private paymentMethodLabel(method: string | null, providerCode: string | null): string {
    if (method && PAYMENT_METHOD_LABEL[method]) {
      return PAYMENT_METHOD_LABEL[method];
    }
    return providerCode ?? '未知';
  }

  private async countMemberPaidOrders(memberBindingId: string): Promise<number> {
    return this.orderRepo.count({
      where: { memberBindingId, status: 'paid' },
    });
  }

  private async todayStats(): Promise<{ amount: number; count: number }> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'amount')
      .addSelect('COUNT(*)', 'count')
      .where('o.status = :status', { status: 'paid' })
      .andWhere('o.created_at >= :start', { start })
      .getRawOne<{ amount: string; count: string }>();
    return {
      amount: Number(rows?.amount ?? 0),
      count: Number(rows?.count ?? 0),
    };
  }

  /**
   * 撈推薦人：玩家 → player_attribution → agent
   * SYSTEM 虛擬代理視為「無推薦人」
   * 任何錯誤都吞掉回 null（推薦人欄位是 nice-to-have）
   */
  private async agentLabel(websiteAccountId: string | undefined): Promise<string | null> {
    if (!websiteAccountId) return null;
    try {
      const attr = await this.attributionRepo.findOne({
        where: { playerId: websiteAccountId },
      });
      if (!attr) return null;
      const agent = await this.agentRepo.findOne({ where: { id: attr.agentId } });
      if (!agent || agent.isSystem) return null;
      return `${agent.name}（${agent.code}）`;
    } catch (err) {
      this.logger.warn(`查推薦人失敗：${(err as Error).message}`);
      return null;
    }
  }
}

function formatNumber(n: number | string): string {
  const num = typeof n === 'string' ? Number(n) : n;
  return new Intl.NumberFormat('en-US').format(num);
}

function formatTime(d: Date): string {
  // 簡單台灣時區格式：YYYY-MM-DD HH:mm:ss（伺服器若已 TZ=Asia/Taipei 就 OK；
  // 若不是請設 process.env.TZ）
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
