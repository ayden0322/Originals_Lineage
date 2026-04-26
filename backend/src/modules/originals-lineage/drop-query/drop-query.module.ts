import { Module } from '@nestjs/common';
import { GameDbModule } from '../game-db/game-db.module';
import { DropQueryService } from './drop-query.service';
import { DropQueryPublicController } from './drop-query.controller';

@Module({
  imports: [GameDbModule],
  controllers: [DropQueryPublicController],
  providers: [DropQueryService],
})
export class DropQueryModule {}
