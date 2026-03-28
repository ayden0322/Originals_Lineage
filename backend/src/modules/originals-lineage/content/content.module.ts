import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './entities/article.entity';
import { Announcement } from './entities/announcement.entity';
import { ArticleCategory } from './entities/article-category.entity';
import { ContentService } from './content.service';
import {
  ContentAdminController,
  ContentPublicController,
} from './content.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Article, Announcement, ArticleCategory])],
  controllers: [ContentAdminController, ContentPublicController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
