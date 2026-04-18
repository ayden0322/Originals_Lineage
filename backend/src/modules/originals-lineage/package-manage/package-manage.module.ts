import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleConfigModule } from '../../../core/module-config/module-config.module';
import { GamePackage } from './entities/game-package.entity';
import { PackageManageService } from './package-manage.service';
import {
  PackageManageAdminController,
  PackageManagePublicController,
} from './package-manage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GamePackage]), ModuleConfigModule],
  controllers: [PackageManageAdminController, PackageManagePublicController],
  providers: [PackageManageService],
  exports: [PackageManageService],
})
export class PackageManageModule {}
