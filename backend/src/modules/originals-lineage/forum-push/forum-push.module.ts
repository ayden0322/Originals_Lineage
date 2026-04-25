import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForumPushApplication } from './entities/forum-push-application.entity';
import { ForumPushItem } from './entities/forum-push-item.entity';
import { ForumPushRewardConfig } from './entities/forum-push-reward-config.entity';
import { ForumPushSettings } from './entities/forum-push-settings.entity';
import { WebsiteUser } from '../member/entities/website-user.entity';
import { GameDbModule } from '../game-db/game-db.module';
import { StorageModule } from '../../../core/storage/storage.module';
import { ForumPushService } from './forum-push.service';
import {
  ForumPushPublicController,
  ForumPushAdminController,
} from './forum-push.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ForumPushApplication,
      ForumPushItem,
      ForumPushRewardConfig,
      ForumPushSettings,
      WebsiteUser,
    ]),
    GameDbModule,
    StorageModule,
  ],
  controllers: [ForumPushPublicController, ForumPushAdminController],
  providers: [ForumPushService],
  exports: [ForumPushService],
})
export class ForumPushModule {}
