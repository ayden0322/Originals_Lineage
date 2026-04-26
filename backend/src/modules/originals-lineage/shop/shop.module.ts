import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ProductTemplate } from './entities/product-template.entity';
import { MemberBinding } from '../member/entities/member-binding.entity';
import { PaymentModule } from '../../../core/payment/payment.module';
import { LineModule } from '../../../core/line/line.module';
import { GameDbModule } from '../game-db/game-db.module';
import { CommissionModule } from '../commission/commission.module';
import { ShopService } from './shop.service';
import { ShopAdminController, ShopPublicController } from './shop.controller';
import { OrderLineNotifyListener } from './listeners/order-line-notify.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Order,
      OrderItem,
      ProductTemplate,
      MemberBinding,
    ]),
    PaymentModule,
    LineModule,
    GameDbModule,
    CommissionModule,
  ],
  controllers: [ShopAdminController, ShopPublicController],
  providers: [ShopService, OrderLineNotifyListener],
  exports: [ShopService],
})
export class ShopModule {}
