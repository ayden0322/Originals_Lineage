import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReserveService } from './reserve.service';
import {
  ReservePublicController,
  ReserveAdminController,
} from './reserve.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation])],
  controllers: [ReservePublicController, ReserveAdminController],
  providers: [ReserveService],
  exports: [ReserveService],
})
export class ReserveModule {}
