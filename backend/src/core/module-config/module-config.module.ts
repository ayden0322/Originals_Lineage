import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleConfig } from './entities/module-config.entity';
import { ModuleConfigService } from './module-config.service';
import { ModuleConfigController } from './module-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ModuleConfig])],
  controllers: [ModuleConfigController],
  providers: [ModuleConfigService],
  exports: [ModuleConfigService],
})
export class ModuleConfigModule {}
