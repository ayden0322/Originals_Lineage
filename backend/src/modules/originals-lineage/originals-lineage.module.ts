import { Module } from '@nestjs/common';
import { GameDbModule } from './game-db/game-db.module';
import { MemberModule } from './member/member.module';
import { ReserveModule } from './reserve/reserve.module';
import { ContentModule } from './content/content.module';
import { ShopModule } from './shop/shop.module';
import { ShopManageModule } from './shop-manage/shop-manage.module';
import { SettingsModule } from './settings/settings.module';
import { SiteManageModule } from './site-manage/site-manage.module';

@Module({
  imports: [
    GameDbModule,
    MemberModule,
    ReserveModule,
    ContentModule,
    ShopModule,
    ShopManageModule,
    SettingsModule,
    SiteManageModule,
  ],
})
export class OriginalsLineageModule {}
