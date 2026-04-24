import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Reservation } from './entities/reservation.entity';
import { ReservationMilestone } from './entities/reservation-milestone.entity';
import { ReservationPageSettings } from './entities/reservation-page-settings.entity';
import { RewardClaim } from './entities/reward-claim.entity';
import { MemberBinding } from '../member/entities/member-binding.entity';
import { ReserveService } from './reserve.service';
import { RewardClaimService } from './reward-claim.service';
import { MilestoneValidationService } from './milestone-validation.service';
import { GameDbModule } from '../game-db/game-db.module';
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
    ScheduleModule.forRoot(),
    GameDbModule,
  ],
  controllers: [ReservePublicController, ReserveAdminController],
  providers: [ReserveService, RewardClaimService, MilestoneValidationService],
  exports: [ReserveService, RewardClaimService, MilestoneValidationService],
})
export class ReserveModule {}
