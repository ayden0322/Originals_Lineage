import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MemberBinding } from './entities/member-binding.entity';
import { WebsiteUser } from './entities/website-user.entity';
import { Order } from '../shop/entities/order.entity';
import { OrderItem } from '../shop/entities/order-item.entity';
import { Product } from '../shop/entities/product.entity';
import { GameDbModule } from '../game-db/game-db.module';
import { SystemLogModule } from '../../../core/system-log/system-log.module';
import { CommissionModule } from '../commission/commission.module';
import { MemberService } from './member.service';
import { MemberController, MemberPublicController } from './member.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MemberBinding,
      WebsiteUser,
      Order,
      OrderItem,
      Product,
    ]),
    GameDbModule,
    SystemLogModule,
    CommissionModule,
    JwtModule.register({}),
  ],
  controllers: [MemberController, MemberPublicController],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
