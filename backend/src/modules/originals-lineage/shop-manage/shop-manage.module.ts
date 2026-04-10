import { Module } from '@nestjs/common';
import { ModuleConfigModule } from '../../../core/module-config/module-config.module';
import { ShopManageService } from './shop-manage.service';
import {
  ShopManageAdminController,
  ShopManagePublicController,
} from './shop-manage.controller';

@Module({
  imports: [ModuleConfigModule],
  controllers: [ShopManageAdminController, ShopManagePublicController],
  providers: [ShopManageService],
  exports: [ShopManageService],
})
export class ShopManageModule {}
