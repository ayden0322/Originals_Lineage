import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// ─── Admin Article & Announcement Controller ─────────────────────────

@ApiTags('Originals - Content (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals')
export class ContentAdminController {
  constructor(private readonly contentService: ContentService) {}

  // ─── Articles ────────────────────────────────────────────────────

  @Post('articles')
  @RequirePermission('module.originals.content.create')
  createArticle(
    @Body() dto: CreateArticleDto,
    @CurrentUser('id') authorId: string,
  ) {
    return this.contentService.createArticle(dto, authorId);
  }

  @Get('articles')
  @RequirePermission('module.originals.content.view')
  findAllArticles(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.contentService.findAllArticles(+page, +limit, status);
  }

  @Get('articles/:id')
  @RequirePermission('module.originals.content.view')
  findArticleById(@Param('id') id: string) {
    return this.contentService.findArticleById(id);
  }

  @Patch('articles/:id')
  @RequirePermission('module.originals.content.edit')
  updateArticle(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.contentService.updateArticle(id, dto);
  }

  @Delete('articles/:id')
  @RequirePermission('module.originals.content.delete')
  deleteArticle(@Param('id') id: string) {
    return this.contentService.deleteArticle(id);
  }

  // ─── Categories ─────────────────────────────────────────────────

  @Get('categories')
  @RequirePermission('module.originals.content.view')
  findAllCategories() {
    return this.contentService.findAllCategories();
  }

  @Post('categories')
  @RequirePermission('module.originals.content.create')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.contentService.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequirePermission('module.originals.content.edit')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.contentService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RequirePermission('module.originals.content.delete')
  deleteCategory(@Param('id') id: string) {
    return this.contentService.deleteCategory(id);
  }

  // ─── Announcements ──────────────────────────────────────────────

  @Post('announcements')
  @RequirePermission('module.originals.content.create')
  createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser('id') authorId: string,
  ) {
    return this.contentService.createAnnouncement(dto, authorId);
  }

  @Get('announcements')
  @RequirePermission('module.originals.content.view')
  findAllAnnouncements(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.contentService.findAllAnnouncements(+page, +limit);
  }

  @Patch('announcements/:id')
  @RequirePermission('module.originals.content.edit')
  updateAnnouncement(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.contentService.updateAnnouncement(id, dto);
  }

  @Delete('announcements/:id')
  @RequirePermission('module.originals.content.delete')
  deleteAnnouncement(@Param('id') id: string) {
    return this.contentService.deleteAnnouncement(id);
  }
}

// ─── Public Article & Announcement Controller ────────────────────────

@ApiTags('Originals - Content (Public)')
@Controller('public/originals')
export class ContentPublicController {
  constructor(private readonly contentService: ContentService) {}

  @Get('articles')
  findPublishedArticles(
    @Query('category') category?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.contentService.findPublishedArticles(+page, +limit, category);
  }

  @Get('articles/:slug')
  findArticleBySlug(@Param('slug') slug: string) {
    return this.contentService.findArticleBySlug(slug);
  }

  @Get('categories')
  findActiveCategories() {
    return this.contentService.findActiveCategories();
  }

  @Get('articles/:slug/adjacent')
  findAdjacentArticles(@Param('slug') slug: string) {
    return this.contentService.findAdjacentArticles(slug);
  }

  @Get('announcements/active')
  findActiveAnnouncements() {
    return this.contentService.findActiveAnnouncements();
  }
}
