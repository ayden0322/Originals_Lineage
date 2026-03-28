import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { Product } from './entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { MemberBinding } from '../member/entities/member-binding.entity';
import { PaymentService } from '../../../core/payment/payment.service';
import { REDIS_CLIENT } from '../../../core/database/redis.module';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOrderDto } from './dto/create-order.dto';

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
    @InjectRepository(MemberBinding)
    private readonly memberBindingRepo: Repository<MemberBinding>,
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ─── Product Methods ──────────────────────────────────────────────────

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const product = this.productRepo.create(dto);
    return this.productRepo.save(product);
  }

  async findAllProducts(
    page = 1,
    limit = 20,
  ): Promise<{ items: Product[]; total: number; page: number; limit: number }> {
    const [items, total] = await this.productRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });

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
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.findProductById(id);
    await this.productRepo.remove(product);
  }

  async findActiveProducts(): Promise<Product[]> {
    const now = new Date();

    const products = await this.productRepo
      .createQueryBuilder('product')
      .where('product.is_active = :isActive', { isActive: true })
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
      .orderBy('product.sort_order', 'ASC')
      .getMany();

    return products;
  }

  // ─── Order Methods ────────────────────────────────────────────────────

  async createOrder(userId: string, dto: CreateOrderDto) {
    // 1. Find member binding
    const memberBinding = await this.memberBindingRepo.findOne({
      where: { websiteAccountId: userId },
    });

    if (!memberBinding) {
      throw new BadRequestException(
        'Member binding not found. Please bind your game account first.',
      );
    }

    if (memberBinding.bindingStatus !== 'verified') {
      throw new BadRequestException(
        'Member binding is not verified. Please verify your game account first.',
      );
    }

    // 2. Acquire Redis distributed lock
    const lockKey = `shop:order:${userId}`;
    const locked = await this.acquireLock(lockKey, 30);
    if (!locked) {
      throw new HttpException(
        'Order is being processed. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      // 3. Validate each item
      const validatedItems: Array<{
        product: Product;
        quantity: number;
      }> = [];

      for (const item of dto.items) {
        const product = await this.productRepo.findOne({
          where: { id: item.productId },
        });

        if (!product) {
          throw new BadRequestException(
            `Product ${item.productId} not found`,
          );
        }

        if (!product.isActive) {
          throw new BadRequestException(
            `Product "${product.name}" is not available`,
          );
        }

        // Check stock (skip if -1 = unlimited)
        if (product.stock !== -1 && product.stock < item.quantity) {
          throw new BadRequestException(
            `Product "${product.name}" is out of stock. Available: ${product.stock}`,
          );
        }

        // Check maxPerUser (skip if 0 = unlimited)
        if (product.maxPerUser > 0) {
          const purchasedCount = await this.orderItemRepo
            .createQueryBuilder('oi')
            .innerJoin('oi.order', 'o')
            .where('o.member_binding_id = :memberBindingId', {
              memberBindingId: memberBinding.id,
            })
            .andWhere('oi.product_id = :productId', {
              productId: product.id,
            })
            .andWhere('o.status != :failedStatus', {
              failedStatus: 'failed',
            })
            .select('COALESCE(SUM(oi.quantity), 0)', 'total')
            .getRawOne();

          const totalPurchased = parseInt(purchasedCount?.total ?? '0', 10);
          if (totalPurchased + item.quantity > product.maxPerUser) {
            throw new BadRequestException(
              `Product "${product.name}" purchase limit exceeded. Max: ${product.maxPerUser}, already purchased: ${totalPurchased}`,
            );
          }
        }

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
        // Atomically decrement stock
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
                `Product "${item.product.name}" is out of stock`,
              );
            }
          }
        }

        // Generate order number: EP + timestamp + 4 random digits
        const timestamp = Date.now().toString();
        const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
        const orderNumber = `EP${timestamp}${randomDigits}`;

        // Create order
        const order = manager.create(Order, {
          orderNumber,
          memberBindingId: memberBinding.id,
          totalAmount,
          status: 'pending',
          deliveryStatus: 'pending',
        });
        const savedOrder = await manager.save(Order, order);

        // Create order items
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

      // 9. Create payment transaction (透過 PaymentRouter 自動選擇通道)
      const paymentResult = await this.paymentService.createTransaction(
        'originals-lineage',    // moduleCode（對應 payment_gateways 的 moduleCode）
        result.id,             // orderId
        result.orderNumber,    // orderNumber
        totalAmount,           // amount
        itemName,              // itemName（ECPay 用）
        `鑽石商城訂單 ${result.orderNumber}`, // description
        dto.paymentMethod,     // paymentMethod（可選）
      );

      // Update order with payment transaction id
      result.paymentTransactionId = paymentResult.transactionId;
      await this.orderRepo.save(result);

      return {
        order: result,
        payment: paymentResult,
      };
    } finally {
      // 10. Release lock
      await this.releaseLock(lockKey);
    }
  }

  // ─── Payment Paid Event Listener ────────────────────────────────────

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

    try {
      const order = await this.orderRepo.findOne({
        where: { id: payload.orderId },
      });

      if (!order) {
        this.logger.warn(`Order not found for payment: ${payload.orderId}`);
        return;
      }

      if (order.status === 'paid') {
        this.logger.log(`Order ${payload.orderId} already marked as paid`);
        return;
      }

      // 更新訂單狀態
      order.status = 'paid';
      order.paymentTransactionId = payload.transactionId;
      await this.orderRepo.save(order);

      // 自動發貨（鑽石發放 — 這裡標記為已發放）
      order.deliveryStatus = 'delivered';
      order.deliveryDetails = {
        deliveredAt: new Date().toISOString(),
        method: 'auto',
        note: `Auto delivery after payment via ${payload.providerCode}`,
      };
      await this.orderRepo.save(order);

      this.logger.log(
        `Order ${payload.orderId} marked as paid and delivered`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process payment.paid event for order ${payload.orderId}`,
        error,
      );
    }
  }

  // ─── Order Query Methods ────────────────────────────────────────────

  async findAllOrders(
    page = 1,
    limit = 20,
  ): Promise<{ items: Order[]; total: number; page: number; limit: number }> {
    const [items, total] = await this.orderRepo.findAndCount({
      relations: ['items'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { items, total, page, limit };
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

    order.deliveryStatus = 'delivered';
    order.deliveryDetails = {
      deliveredAt: new Date().toISOString(),
      method: 'retry',
      note: 'Manual retry delivery',
    };

    return this.orderRepo.save(order);
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
