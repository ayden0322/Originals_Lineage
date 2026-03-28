import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { MemberBinding } from '../member/entities/member-binding.entity';
import { PaymentModule } from '../../../core/payment/payment.module';
import { ShopService } from './shop.service';
import { ShopAdminController, ShopPublicController } from './shop.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Order, OrderItem, MemberBinding]),
    PaymentModule,
  ],
  controllers: [ShopAdminController, ShopPublicController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
