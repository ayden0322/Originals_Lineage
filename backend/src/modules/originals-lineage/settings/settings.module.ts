import { Module } from '@nestjs/common';
import { ModuleConfigModule } from '../../../core/module-config/module-config.module';
import { GameDbModule } from '../game-db/game-db.module';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [ModuleConfigModule, GameDbModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
