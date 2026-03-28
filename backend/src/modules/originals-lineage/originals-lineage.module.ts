import { Module } from '@nestjs/common';
import { GameDbModule } from './game-db/game-db.module';
import { MemberModule } from './member/member.module';
import { ModuleAdminModule } from './admin/module-admin.module';
import { ReserveModule } from './reserve/reserve.module';
import { ContentModule } from './content/content.module';
import { ShopModule } from './shop/shop.module';
import { SettingsModule } from './settings/settings.module';
import { SiteManageModule } from './site-manage/site-manage.module';

@Module({
  imports: [
    GameDbModule,
    MemberModule,
    ModuleAdminModule,
    ReserveModule,
    ContentModule,
    ShopModule,
    SettingsModule,
    SiteManageModule,
  ],
})
export class OriginalsLineageModule {}
