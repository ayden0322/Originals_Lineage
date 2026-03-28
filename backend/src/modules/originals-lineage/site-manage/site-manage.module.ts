import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleConfigModule } from '../../../core/module-config/module-config.module';
import { ContentModule } from '../content/content.module';
import { SiteSection } from './entities/site-section.entity';
import { CarouselSlide } from './entities/carousel-slide.entity';
import { SiteManageService } from './site-manage.service';
import {
  SiteManageAdminController,
  SiteManagePublicController,
} from './site-manage.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SiteSection, CarouselSlide]),
    ModuleConfigModule,
    ContentModule,
  ],
  controllers: [SiteManageAdminController, SiteManagePublicController],
  providers: [SiteManageService],
  exports: [SiteManageService],
})
export class SiteManageModule {}
