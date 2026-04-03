import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationMilestone } from './entities/reservation-milestone.entity';
import { ReserveService } from './reserve.service';
import {
  ReservePublicController,
  ReserveAdminController,
} from './reserve.controller';
import { ModuleConfigModule } from '../../../core/module-config/module-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, ReservationMilestone]),
    ModuleConfigModule,
  ],
  controllers: [ReservePublicController, ReserveAdminController],
  providers: [ReserveService],
  exports: [ReserveService],
})
export class ReserveModule {}
