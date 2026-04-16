import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationMilestone } from './entities/reservation-milestone.entity';
import { ReservationPageSettings } from './entities/reservation-page-settings.entity';
import { MemberBinding } from '../member/entities/member-binding.entity';
import { ReserveService } from './reserve.service';
import {
  ReservePublicController,
  ReserveAdminController,
} from './reserve.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      ReservationMilestone,
      ReservationPageSettings,
      MemberBinding,
    ]),
  ],
  controllers: [ReservePublicController, ReserveAdminController],
  providers: [ReserveService],
  exports: [ReserveService],
})
export class ReserveModule {}
