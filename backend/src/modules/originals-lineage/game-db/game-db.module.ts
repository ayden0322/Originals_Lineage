import { Module } from '@nestjs/common';
import { ModuleConfigModule } from '../../../core/module-config/module-config.module';
import { GameDbService } from './game-db.service';

@Module({
  imports: [ModuleConfigModule],
  providers: [GameDbService],
  exports: [GameDbService],
})
export class GameDbModule {}
