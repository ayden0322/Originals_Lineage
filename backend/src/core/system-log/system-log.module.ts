import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemLog } from './entities/system-log.entity';
import { SystemLogService } from './system-log.service';
import { SystemLogController } from './system-log.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SystemLog])],
  controllers: [SystemLogController],
  providers: [SystemLogService],
  exports: [SystemLogService],
})
export class SystemLogModule {}
