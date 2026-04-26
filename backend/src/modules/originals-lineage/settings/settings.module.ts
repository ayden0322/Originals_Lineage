import { Module } from '@nestjs/common';
import { ModuleConfigModule } from '../../../core/module-config/module-config.module';
import { LineModule } from '../../../core/line/line.module';
import { GameDbModule } from '../game-db/game-db.module';
import { SettingsService } from './settings.service';
import { SettingsController, LineInvitePublicController } from './settings.controller';

@Module({
  imports: [ModuleConfigModule, GameDbModule, LineModule],
  controllers: [SettingsController, LineInvitePublicController],
  providers: [SettingsService],
})
export class SettingsModule {}
