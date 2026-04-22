import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { Product } from './entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ProductTemplate } from './entities/product-template.entity';
import { MemberBinding } from '../member/entities/member-binding.entity';
import { GameDbService } from '../game-db/game-db.service';
import { PaymentService } from '../../../core/payment/payment.service';
import { RefundService } from '../commission/services/refund.service';
import { REDIS_CLIENT } from '../../../core/database/redis.module';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  CreateProductTemplateDto,
  UpdateProductTemplateDto,
} from './dto/product-template.dto';

/** 後台訂單檢視：Order 實體 + 遊戲帳號名，方便識別是哪位玩家的訂單 */
export type AdminOrderView = Order & {
  gameAccountName: string | null;
};

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(ProductTemplate)
    private readonly templateRepo: Repository<ProductTemplate>,
    @InjectRepository(MemberBinding)
    private readonly memberBindingRepo: Repository<MemberBinding>,
    private readonly paymentService: PaymentService,
    private readonly gameDbService: GameDbService,
    private readonly refundService: RefundService,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Product Methods ──────────────────────────────────────────────────

  private validateProductCategoryFields(dto: CreateProductDto | UpdateProductDto, isCreate: boolean) {
    const cat = dto.category;
    if (!cat) {
      if (isCreate) throw new BadRequestException('分類為必填');
      return;
    }
    if (cat === 'diamond') {
      if (isCreate && (dto.diamondAmount == null || dto.diamondAmount <= 0)) {
        throw new BadRequestException('鑽石類商品必須設定鑽石數量');
      }
    } else if (cat === 'game_item' || cat === 'monthly_card') {
      if (isCreate && (!dto.gameItemId || !dto.gameItemName)) {
        throw new BadRequestException('遊戲禮包/月卡必須選擇遊戲物品');
      }
    }
    // 每週限制需同時提供 day + hour
    if (dto.weeklyLimit != null) {
      if (dto.weeklyResetDay == null || dto.weeklyResetHour == null) {
        throw new BadRequestException('設定每週限購時，必須同時指定重置星期與時間');
      }
    }
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    this.validateProductCategoryFields(dto, true);
    const product = this.productRepo.create({
      ...dto,
      diamondAmount: dto.diamondAmount ?? 0,
      gameItemQuantity: dto.gameItemQuantity ?? 1,
      stock: dto.stock ?? -1,
      accountLimit: dto.accountLimit ?? 0,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      startTime: dto.startTime ? new Date(dto.startTime) : null,
      endTime: dto.endTime ? new Date(dto.endTime) : null,
    });
    return this.productRepo.save(product);
  }

  async findAllProducts(
    page = 1,
    limit = 20,
    category?: string,
  ): Promise<{ items: Product[]; total: number; page: number; limit: number }> {
    const qb = this.productRepo
      .createQueryBuilder('product')
      .orderBy('product.category', 'ASC')
      .addOrderBy('product.sort_order', 'ASC')
      .addOrderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // 後台只顯示 diamond（四海銀票）類別；舊的 game_item / monthly_card 完全隱藏
    if (category) {
      qb.where('product.category = :category', { category: 'diamond' });
    } else {
      qb.where('product.category = :category', { category: 'diamond' });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findProductById(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findProductById(id);
    this.validateProductCategoryFields({ ...product, ...dto } as CreateProductDto, false);
    Object.assign(product, dto);
    if (dto.startTime !== undefined) {
      product.startTime = dto.startTime ? new Date(dto.startTime) : null;
    }
    if (dto.endTime !== undefined) {
      product.endTime = dto.endTime ? new Date(dto.endTime) : null;
    }
    return this.productRepo.save(product);
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.findProductById(id);
    await this.productRepo.remove(product);
  }

  /**
   * 移動商品排序（同分類內互換）— 上移/下移用
   */
  async moveProduct(id: string, direction: 'up' | 'down'): Promise<void> {
    const product = await this.findProductById(id);
    const neighbor = await this.productRepo
      .createQueryBuilder('p')
      .where('p.category = :category', { category: product.category })
      .andWhere(
        direction === 'up'
          ? 'p.sort_order < :sortOrder'
          : 'p.sort_order > :sortOrder',
        { sortOrder: product.sortOrder },
      )
      .orderBy('p.sort_order', direction === 'up' ? 'DESC' : 'ASC')
      .getOne();

    if (!neighbor) return;

    const tmp = product.sortOrder;
    product.sortOrder = neighbor.sortOrder;
    neighbor.sortOrder = tmp;
    await this.productRepo.save([product, neighbor]);
  }

  async findActiveProducts(): Promise<Product[]> {
    const now = new Date();

    const products = await this.productRepo
      .createQueryBuilder('product')
      .where('product.is_active = :isActive', { isActive: true })
      // 公開頁僅顯示 diamond（四海銀票）類別
      .andWhere('product.category = :category', { category: 'diamond' })
      .andWhere(
        new Brackets((qb) => {
          qb.where('product.start_time IS NULL').orWhere(
            'product.start_time <= :now',
            { now },
          );
        }),
      )
      .andWhere(
        new Brackets((qb) => {
          qb.where('product.end_time IS NULL').orWhere(
            'product.end_time >= :now',
            { now },
          );
        }),
      )
      .orderBy('product.category', 'ASC')
      .addOrderBy('product.sort_order', 'ASC')
      .getMany();

    return products;
  }

  // ─── 限購週期計算（Asia/Taipei） ─────────────────────────────────────

  /**
   * 取得 Asia/Taipei 的「現在」為基準算出的各個週期起點
   */
  private getCycleStarts(): { dayStart: Date; monthStart: Date } {
    // 用 Date 直接 +8 偏移後算當天/當月零點，再扣回 UTC
    const now = new Date();
    const tpe = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const y = tpe.getUTCFullYear();
    const m = tpe.getUTCMonth();
    const d = tpe.getUTCDate();

    const dayStart = new Date(Date.UTC(y, m, d) - 8 * 60 * 60 * 1000);
    const monthStart = new Date(Date.UTC(y, m, 1) - 8 * 60 * 60 * 1000);
    return { dayStart, monthStart };
  }

  /**
   * 計算「最近一次每週重置時點」（以 Asia/Taipei 為基準）
   * @param resetDay 0=週日 ~ 6=週六
   * @param resetHour 0~23
   */
  private getWeeklyResetStart(resetDay: number, resetHour: number): Date {
    const now = new Date();
    const tpe = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const currentDow = tpe.getUTCDay(); // 0~6
    const currentHour = tpe.getUTCHours();

    // 距離上次 resetDay 已過多少天
    let daysAgo = (currentDow - resetDay + 7) % 7;
    // 如果今天是 resetDay 但時間還沒到 resetHour，要回到上週同一天
    if (daysAgo === 0 && currentHour < resetHour) {
      daysAgo = 7;
    }

    const y = tpe.getUTCFullYear();
    const m = tpe.getUTCMonth();
    const d = tpe.getUTCDate();
    const resetTpe = Date.UTC(y, m, d - daysAgo, resetHour, 0, 0);
    return new Date(resetTpe - 8 * 60 * 60 * 1000);
  }

  /**
   * 統計某 memberBinding 在某時段內已購買的商品數量
   */
  private async countPurchasedSince(
    memberBindingId: string,
    productId: string,
    since: Date,
  ): Promise<number> {
    const result = await this.orderItemRepo
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .where('o.member_binding_id = :memberBindingId', { memberBindingId })
      .andWhere('oi.product_id = :productId', { productId })
      .andWhere('o.status != :failedStatus', { failedStatus: 'failed' })
      .andWhere('o.created_at >= :since', { since })
      .select('COALESCE(SUM(oi.quantity), 0)', 'total')
      .getRawOne<{ total: string }>();
    return parseInt(result?.total ?? '0', 10);
  }

  /**
   * 統計某 memberBinding 對某商品的總購買數量
   */
  private async countPurchasedTotal(
    memberBindingId: string,
    productId: string,
  ): Promise<number> {
    const result = await this.orderItemRepo
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .where('o.member_binding_id = :memberBindingId', { memberBindingId })
      .andWhere('oi.product_id = :productId', { productId })
      .andWhere('o.status != :failedStatus', { failedStatus: 'failed' })
      .select('COALESCE(SUM(oi.quantity), 0)', 'total')
      .getRawOne<{ total: string }>();
    return parseInt(result?.total ?? '0', 10);
  }

  /**
   * 商品限購完整檢查（含等級、總購買、每日/每週/每月）
   * 不通過時直接拋出 BadRequestException
   */
  private async checkPurchaseLimits(
    product: Product,
    memberBinding: MemberBinding,
    quantity: number,
  ) {
    // 1. 等級限制
    if (product.requiredLevel != null && product.requiredLevel > 0) {
      if (!this.gameDbService.isConnected) {
        throw new BadRequestException(
          `商品「${product.name}」需要角色等級 ${product.requiredLevel}，但目前無法驗證遊戲帳號等級`,
        );
      }
      const maxLevel = await this.gameDbService.getMaxLevelByAccount(
        memberBinding.gameAccountName,
      );
      if (maxLevel < product.requiredLevel) {
        throw new BadRequestException(
          `商品「${product.name}」需要角色等級 ${product.requiredLevel}（您目前最高 ${maxLevel}）`,
        );
      }
    }

    // 2. 帳號總購買上限
    if (product.accountLimit > 0) {
      const total = await this.countPurchasedTotal(memberBinding.id, product.id);
      if (total + quantity > product.accountLimit) {
        throw new BadRequestException(
          `商品「${product.name}」帳號限購 ${product.accountLimit} 次，您已購買 ${total} 次`,
        );
      }
    }

    const { dayStart, monthStart } = this.getCycleStarts();

    // 3. 每日限制
    if (product.dailyLimit != null && product.dailyLimit > 0) {
      const todayCount = await this.countPurchasedSince(
        memberBinding.id,
        product.id,
        dayStart,
      );
      if (todayCount + quantity > product.dailyLimit) {
        throw new BadRequestException(
          `商品「${product.name}」每日限購 ${product.dailyLimit} 次，今日已購買 ${todayCount} 次`,
        );
      }
    }

    // 4. 每週限制
    if (
      product.weeklyLimit != null &&
      product.weeklyLimit > 0 &&
      product.weeklyResetDay != null &&
      product.weeklyResetHour != null
    ) {
      const weekStart = this.getWeeklyResetStart(
        product.weeklyResetDay,
        product.weeklyResetHour,
      );
      const weekCount = await this.countPurchasedSince(
        memberBinding.id,
        product.id,
        weekStart,
      );
      if (weekCount + quantity > product.weeklyLimit) {
        throw new BadRequestException(
          `商品「${product.name}」每週限購 ${product.weeklyLimit} 次，本週已購買 ${weekCount} 次`,
        );
      }
    }

    // 5. 每月限制
    if (product.monthlyLimit != null && product.monthlyLimit > 0) {
      const monthCount = await this.countPurchasedSince(
        memberBinding.id,
        product.id,
        monthStart,
      );
      if (monthCount + quantity > product.monthlyLimit) {
        throw new BadRequestException(
          `商品「${product.name}」每月限購 ${product.monthlyLimit} 次，本月已購買 ${monthCount} 次`,
        );
      }
    }
  }

  // ─── Order Methods ────────────────────────────────────────────────────

  async createOrder(userId: string, dto: CreateOrderDto) {
    // 1. Find member binding
    const memberBinding = await this.memberBindingRepo.findOne({
      where: { websiteAccountId: userId },
    });

    if (!memberBinding) {
      throw new BadRequestException(
        '未綁定遊戲帳號，請先完成綁定後再購買',
      );
    }

    if (memberBinding.bindingStatus !== 'verified') {
      throw new BadRequestException('遊戲帳號尚未驗證');
    }

    // 額外保護：account_name varchar(13) 限制
    if (memberBinding.gameAccountName.length > 13) {
      throw new BadRequestException(
        '您的遊戲帳號名稱超過遊戲允許長度（13 字元），請聯絡客服',
      );
    }

    // 2. Acquire Redis distributed lock
    const lockKey = `shop:order:${userId}`;
    const locked = await this.acquireLock(lockKey, 30);
    if (!locked) {
      throw new HttpException(
        '訂單處理中，請稍後再試',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      // 3. Validate each item + 限購檢查
      const validatedItems: Array<{ product: Product; quantity: number }> = [];

      for (const item of dto.items) {
        const product = await this.productRepo.findOne({
          where: { id: item.productId },
        });
        if (!product) {
          throw new BadRequestException(`商品 ${item.productId} 不存在`);
        }
        if (!product.isActive) {
          throw new BadRequestException(`商品「${product.name}」已下架`);
        }

        // 庫存
        if (product.stock !== -1 && product.stock < item.quantity) {
          throw new BadRequestException(
            `商品「${product.name}」庫存不足（剩 ${product.stock}）`,
          );
        }

        // 最低購買金額門檻
        const minAmount = Number(product.minPurchaseAmount ?? 0);
        if (minAmount > 0) {
          const subtotal = Number(product.price) * item.quantity;
          if (subtotal < minAmount) {
            throw new BadRequestException(
              `商品「${product.name}」最低購買金額為 NT$ ${minAmount.toLocaleString('zh-TW')}（目前 NT$ ${subtotal.toLocaleString('zh-TW')}）`,
            );
          }
        }

        // 限購（含等級、總/每日/每週/每月）
        await this.checkPurchaseLimits(product, memberBinding, item.quantity);

        validatedItems.push({ product, quantity: item.quantity });
      }

      // 4. Calculate total amount
      const totalAmount = validatedItems.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity,
        0,
      );

      // 5. 組合商品名稱（ECPay 用 # 分隔多商品）
      const itemName = validatedItems
        .map((item) => `${item.product.name} x${item.quantity}`)
        .join('#');

      // 6 + 7 + 8. Transaction: decrement stock, create order + items
      const result = await this.dataSource.transaction(async (manager) => {
        for (const item of validatedItems) {
          if (item.product.stock !== -1) {
            const updateResult = await manager
              .createQueryBuilder()
              .update(Product)
              .set({ stock: () => `stock - ${item.quantity}` })
              .where('id = :id AND stock >= :qty', {
                id: item.product.id,
                qty: item.quantity,
              })
              .execute();

            if (updateResult.affected === 0) {
              throw new BadRequestException(
                `商品「${item.product.name}」庫存不足`,
              );
            }
          }
        }

        const timestamp = Date.now().toString();
        const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
        const orderNumber = `EP${timestamp}${randomDigits}`;

        const order = manager.create(Order, {
          orderNumber,
          memberBindingId: memberBinding.id,
          totalAmount,
          status: 'pending',
          deliveryStatus: 'pending',
        });
        const savedOrder = await manager.save(Order, order);

        const orderItems = validatedItems.map((item) =>
          manager.create(OrderItem, {
            orderId: savedOrder.id,
            productId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.product.price,
            diamondAmount: item.product.diamondAmount,
          }),
        );
        await manager.save(OrderItem, orderItems);

        savedOrder.items = orderItems;
        return savedOrder;
      });

      // 9. Create payment transaction
      const paymentResult = await this.paymentService.createTransaction(
        'originals-lineage',
        result.id,
        result.orderNumber,
        totalAmount,
        itemName,
        `商城訂單 ${result.orderNumber}`,
        dto.paymentMethod,
      );

      result.paymentTransactionId = paymentResult.transactionId;
      await this.orderRepo.save(result);

      return { order: result, payment: paymentResult };
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  // ─── Payment Paid Event Listener ────────────────────────────────────

  /**
   * 付款成功事件 → 自動發貨
   *
   * 為什麼要這樣寫（重要）：
   * 1. **幂等（防重複發放）**：金流商可能重複推送 callback（網路抖動、手動重推），
   *    我們用一條 atomic UPDATE 從 `pending`/`failed` 搶到 `processing` 狀態，
   *    `affected === 0` 表示已被其他 handler 搶走或已 delivered，直接 return。
   *    這比「先 SELECT 再判斷」能避免並發 race。
   *
   * 2. **自動重試（2-3 分鐘）**：遊戲資料庫寫入可能因連線抖動暫時失敗，
   *    我們重試 4 次，間隔 0s → 30s → 60s → 90s，總耗時 ~3 分鐘。
   *    每次成功就立刻跳出；全部失敗才標記為 `failed`。
   *
   * 3. **最終失敗標記**：4 次都失敗 → `delivery_status = 'failed'` + 提示訊息
   *    「購買異常，請聯絡客服」寫進 `delivery_details`，後台可手動 retry。
   */
  @OnEvent('payment.paid')
  async handlePaymentPaid(payload: {
    orderId: string;
    moduleCode: string;
    transactionId: string;
    amount: number;
    providerCode: string;
  }) {
    if (payload.moduleCode !== 'originals-lineage') return;

    this.logger.log(
      `Payment paid event received for order: ${payload.orderId}`,
    );

    // ─── Step 1：原子搶領（idempotency）──────────────────────────
    // 只有「pending 或 failed」才允許被搶領為 processing；
    // 已經 processing / delivered 的直接跳過，避免重複發放。
    const claim = await this.orderRepo
      .createQueryBuilder()
      .update(Order)
      .set({
        status: 'paid',
        deliveryStatus: 'processing',
        paymentTransactionId: payload.transactionId,
      })
      .where('id = :id', { id: payload.orderId })
      .andWhere('delivery_status IN (:...statuses)', {
        statuses: ['pending', 'failed'],
      })
      .execute();

    if (claim.affected === 0) {
      this.logger.log(
        `Order ${payload.orderId} 已被其他 handler 處理或已 delivered，跳過`,
      );
      return;
    }

    const order = await this.orderRepo.findOne({
      where: { id: payload.orderId },
      relations: ['items'],
    });
    if (!order) {
      this.logger.warn(`Order not found for payment: ${payload.orderId}`);
      return;
    }

    // ─── Step 1.5：觸發代理分潤計算 ─────────────────────────────
    // 分潤計算以「付款成功」為基準（設計文件第四章：分潤基準 = 玩家儲值金額）。
    // 即使發貨失敗，分潤也已產生；CommissionEngineService 依 transactionId 冪等。
    // 透過事件解耦：若 commission 模組未啟用或監聽失敗，不會影響發貨主流程。
    try {
      const binding = await this.memberBindingRepo.findOne({
        where: { id: order.memberBindingId },
      });
      if (binding) {
        this.eventEmitter.emit('commission.recharge.paid', {
          transactionId: payload.transactionId,
          playerId: binding.websiteAccountId,
          amount: Number(order.totalAmount),
          paidAt: new Date(),
        });
        this.logger.log(
          `已發出 commission.recharge.paid 事件 order=${order.orderNumber} amount=${order.totalAmount}`,
        );
      } else {
        this.logger.warn(
          `Order ${order.orderNumber} 找不到 member_binding，跳過分潤事件`,
        );
      }
    } catch (err) {
      // 分潤事件發送失敗不應阻斷發貨流程；記 log 後繼續
      this.logger.error(
        `發出分潤事件失敗 order=${order.orderNumber}: ${(err as Error).message}`,
      );
    }

    // ─── Step 2：帶重試的發貨流程 ────────────────────────────────
    // 0s → 30s → 60s → 90s，總耗時 ~3 分鐘
    const RETRY_DELAYS_MS = [0, 30_000, 60_000, 90_000];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      if (RETRY_DELAYS_MS[attempt] > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
      try {
        await this.deliverOrder(order);
        this.logger.log(
          `Order ${payload.orderId} 發貨成功（第 ${attempt + 1} 次嘗試）`,
        );
        return;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Order ${payload.orderId} 發貨失敗（第 ${attempt + 1}/${RETRY_DELAYS_MS.length} 次）：${lastError.message}`,
        );
      }
    }

    // ─── Step 3：所有嘗試都失敗 → 標記異常 ──────────────────────
    order.deliveryStatus = 'failed';
    order.deliveryDetails = {
      failedAt: new Date().toISOString(),
      error: lastError?.message ?? 'unknown',
      attempts: RETRY_DELAYS_MS.length,
      userMessage: '購買異常，請聯絡客服',
    };
    await this.orderRepo.save(order);
    this.logger.error(
      `Order ${payload.orderId} 發貨最終失敗（已重試 ${RETRY_DELAYS_MS.length} 次）`,
      lastError,
    );
  }

  /**
   * 實際把商品寫入遊戲資料庫
   * - 鑽石類 → ancestor.贊助_儲值記錄
   * - 遊戲禮包/月卡 → ancestor.輔助_獎勵發送
   */
  private async deliverOrder(order: Order): Promise<void> {
    if (!this.gameDbService.isConnected) {
      throw new Error('遊戲資料庫未連線');
    }

    const memberBinding = await this.memberBindingRepo.findOne({
      where: { id: order.memberBindingId },
    });
    if (!memberBinding) {
      throw new Error('找不到對應會員綁定');
    }
    const accountName = memberBinding.gameAccountName;

    const deliveredEntries: Array<Record<string, unknown>> = [];

    for (const item of order.items) {
      const product = await this.productRepo.findOne({
        where: { id: item.productId },
      });
      if (!product) {
        throw new Error(`找不到商品 ${item.productId}`);
      }

      for (let i = 0; i < item.quantity; i++) {
        if (product.category === 'diamond') {
          const diamonds = product.diamondAmount;
          const insertId = await this.gameDbService.insertDiamondTopup(
            accountName,
            diamonds,
          );
          deliveredEntries.push({
            type: 'diamond',
            table: '贊助_儲值記錄',
            insertId,
            account: accountName,
            count: diamonds,
          });
        } else if (
          product.category === 'game_item' ||
          product.category === 'monthly_card'
        ) {
          if (!product.gameItemId || !product.gameItemName) {
            throw new Error(`商品「${product.name}」未設定遊戲物品`);
          }
          const insertId = await this.gameDbService.insertGiftReward(
            accountName,
            product.gameItemId,
            product.gameItemName,
            product.gameItemQuantity || 1,
          );
          deliveredEntries.push({
            type: product.category,
            table: '輔助_獎勵發送',
            insertId,
            account: accountName,
            itemId: product.gameItemId,
            itemName: product.gameItemName,
            quantity: product.gameItemQuantity || 1,
          });
        } else {
          throw new Error(`未知商品分類：${String(product.category)}`);
        }
      }
    }

    order.deliveryStatus = 'delivered';
    order.deliveryDetails = {
      deliveredAt: new Date().toISOString(),
      method: 'auto',
      entries: deliveredEntries,
    };
    await this.orderRepo.save(order);

    this.logger.log(`Order ${order.id} delivered (${deliveredEntries.length} entries)`);
  }

  // ─── Order Query Methods ────────────────────────────────────────────

  /**
   * 幫訂單補上遊戲帳號名
   * - 單次查詢 memberBindings，避免 N+1
   * - 供後台列表／詳情使用；一般玩家端無需此資訊
   */
  private async enrichOrders(orders: Order[]): Promise<AdminOrderView[]> {
    if (orders.length === 0) return [];

    const bindingIds = Array.from(
      new Set(orders.map((o) => o.memberBindingId).filter(Boolean)),
    );
    const bindings = bindingIds.length
      ? await this.memberBindingRepo
          .createQueryBuilder('b')
          .where('b.id IN (:...ids)', { ids: bindingIds })
          .getMany()
      : [];
    const bindingMap = new Map(bindings.map((b) => [b.id, b]));

    return orders.map((o) => {
      const binding = bindingMap.get(o.memberBindingId);
      return Object.assign(o, {
        gameAccountName: binding?.gameAccountName ?? null,
      }) as AdminOrderView;
    });
  }

  async findAllOrders(
    page = 1,
    limit = 20,
  ): Promise<{ items: AdminOrderView[]; total: number; page: number; limit: number }> {
    const [items, total] = await this.orderRepo.findAndCount({
      relations: ['items'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const enriched = await this.enrichOrders(items);
    return { items: enriched, total, page, limit };
  }

  async findOrderById(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * 後台訂單詳情（帶會員資料）
   */
  async findAdminOrderById(id: string): Promise<AdminOrderView> {
    const order = await this.findOrderById(id);
    const [enriched] = await this.enrichOrders([order]);
    return enriched;
  }

  async findOrdersByMember(
    memberBindingId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: Order[]; total: number; page: number; limit: number }> {
    const [items, total] = await this.orderRepo.findAndCount({
      where: { memberBindingId },
      relations: ['items'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { items, total, page, limit };
  }

  async findOrdersByUserId(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: Order[]; total: number; page: number; limit: number }> {
    const memberBinding = await this.memberBindingRepo.findOne({
      where: { websiteAccountId: userId },
    });

    if (!memberBinding) {
      return { items: [], total: 0, page, limit };
    }

    return this.findOrdersByMember(memberBinding.id, page, limit);
  }

  async retryDelivery(orderId: string): Promise<Order> {
    const order = await this.findOrderById(orderId);
    await this.deliverOrder(order);
    return this.findOrderById(orderId);
  }

  /**
   * 後台：一鍵退款
   * - 僅允許 status='paid' 的訂單
   * - 將 order.status 改為 'refunded'，並呼叫 RefundService 產生分潤沖銷
   * - 整個流程在同一個 transaction 中，任何一步失敗都會 rollback
   * - 不動庫存、不回收遊戲道具（依業務需求可自行加）
   */
  async refundOrder(params: {
    orderId: string;
    reason?: string;
    operatorId?: string;
  }): Promise<{ order: AdminOrderView; adjustmentsCreated: number }> {
    const { orderId, reason, operatorId } = params;

    await this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('o')
        .setLock('pessimistic_write')
        .where('o.id = :id', { id: orderId })
        .getOne();

      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status === 'refunded') {
        throw new ConflictException('此訂單已退款，請勿重複操作');
      }
      if (order.status !== 'paid') {
        throw new BadRequestException(
          `訂單狀態為 ${order.status}，僅允許退款已付款 (paid) 的訂單`,
        );
      }

      order.status = 'refunded';
      order.deliveryDetails = {
        ...(order.deliveryDetails ?? {}),
        refundedAt: new Date().toISOString(),
        refundedBy: operatorId ?? null,
        refundReason: reason ?? null,
      };
      await manager.getRepository(Order).save(order);
    });

    // transaction 外再做分潤沖銷：RefundService 內部自己會處理冪等與結算期建立
    // 刻意不包進同一個 transaction，因為 adjustment 寫入要看到主要 order 的 status 變更
    // 且 RefundService 自己有冪等檢查（sourceTransactionId 唯一），安全可補跑
    let adjustmentsCreated = 0;
    const refreshed = await this.findOrderById(orderId);
    if (refreshed.paymentTransactionId) {
      try {
        const res = await this.refundService.applyRefund({
          transactionId: refreshed.paymentTransactionId,
          operatorId,
          reason:
            reason ??
            `訂單退款：${refreshed.orderNumber}`,
        });
        adjustmentsCreated = res.adjustmentsCreated;
      } catch (err) {
        // 若是 ConflictException（已沖銷過）則視為成功，只是補沖銷這步 skip
        const e = err as { status?: number; response?: { statusCode?: number } };
        const status = e.status ?? e.response?.statusCode;
        if (status !== 409) {
          this.logger.error(
            `Order ${orderId} refund adjustment failed: ${(err as Error).message}`,
            (err as Error).stack,
          );
          throw err;
        }
        this.logger.warn(
          `Order ${orderId} 分潤沖銷已存在，skip（可能為補救二次執行）`,
        );
      }
    } else {
      this.logger.log(
        `Order ${orderId} 無 paymentTransactionId，僅改狀態、不做分潤沖銷`,
      );
    }

    this.logger.log(
      `Order ${orderId} refunded, adjustments=${adjustmentsCreated}, operator=${operatorId ?? 'system'}`,
    );

    const enriched = await this.findAdminOrderById(orderId);
    return { order: enriched, adjustmentsCreated };
  }

  // ─── Game Items Lookup（後台選遊戲物品用）─────────────────────────

  async findGameItems(search: string | undefined, page = 1, limit = 20) {
    if (!this.gameDbService.isConnected) {
      throw new BadRequestException('遊戲資料庫未連線，請先在設定頁面配置');
    }
    return this.gameDbService.findGameItems(search, page, limit);
  }

  // ─── Product Templates（共用範本） ─────────────────────────────────

  async createTemplate(
    dto: CreateProductTemplateDto,
    createdBy: string | null,
  ): Promise<ProductTemplate> {
    const tpl = this.templateRepo.create({ ...dto, createdBy });
    return this.templateRepo.save(tpl);
  }

  async findAllTemplates(category?: string): Promise<ProductTemplate[]> {
    const where = category ? { category: category as never } : {};
    return this.templateRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findTemplateById(id: string): Promise<ProductTemplate> {
    const tpl = await this.templateRepo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('範本不存在');
    return tpl;
  }

  async updateTemplate(id: string, dto: UpdateProductTemplateDto): Promise<ProductTemplate> {
    const tpl = await this.findTemplateById(id);
    Object.assign(tpl, dto);
    return this.templateRepo.save(tpl);
  }

  async deleteTemplate(id: string): Promise<void> {
    const tpl = await this.findTemplateById(id);
    await this.templateRepo.remove(tpl);
  }

  // ─── Redis Lock Helpers ───────────────────────────────────────────────

  private async acquireLock(key: string, ttl: number): Promise<boolean> {
    const result = await this.redis.set(key, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  private async releaseLock(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
