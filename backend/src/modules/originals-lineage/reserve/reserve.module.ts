import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationMilestone } from './entities/reservation-milestone.entity';
import { ReservationPageSettings } from './entities/reservation-page-settings.entity';
import { RewardClaim } from './entities/reward-claim.entity';
import { MemberBinding } from '../member/entities/member-binding.entity';
import { ReserveService } from './reserve.service';
import { RewardClaimService } from './reward-claim.service';
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
      RewardClaim,
      MemberBinding,
    ]),
  ],
  controllers: [ReservePublicController, ReserveAdminController],
  providers: [ReserveService, RewardClaimService],
  exports: [ReserveService, RewardClaimService],
})
export class ReserveModule {}
