import { Module } from '@nestjs/common';
import { ModuleConfigModule } from '../module-config/module-config.module';
import { LineService } from './line.service';
import { LineWebhookController } from './line.controller';

@Module({
  imports: [ModuleConfigModule],
  controllers: [LineWebhookController],
  providers: [LineService],
  exports: [LineService],
})
export class LineModule {}
