import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemLog } from './entities/system-log.entity';
import { SystemLogService } from './system-log.service';
import { SystemLogController } from './system-log.controller';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([SystemLog])],
  controllers: [SystemLogController],
  providers: [
    SystemLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [SystemLogService],
})
export class SystemLogModule {}
