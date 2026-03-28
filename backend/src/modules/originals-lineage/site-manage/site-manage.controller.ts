import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SiteManageService } from './site-manage.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateCarouselSlideDto } from './dto/create-carousel-slide.dto';
import { UpdateCarouselSlideDto } from './dto/update-carousel-slide.dto';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { ReorderDto } from './dto/reorder.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';

// ─── Admin Controller ───────────────────────────────────────────────

@ApiTags('Originals - Site Manage (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals/site-manage')
export class SiteManageAdminController {
  constructor(private readonly siteManageService: SiteManageService) {}

  // ─── Site Settings ──────────────────────────────────────────────

  @Get('settings')
  @RequirePermission('module.originals.content.view')
  getSettings() {
    return this.siteManageService.getSiteSettings();
  }

  @Put('settings')
  @RequirePermission('module.originals.content.edit')
  updateSettings(@Body() dto: UpdateSiteSettingsDto) {
    return this.siteManageService.updateSiteSettings(dto);
  }

  // ─── Sections ───────────────────────────────────────────────────

  @Get('sections')
  @RequirePermission('module.originals.content.view')
  findAllSections() {
    return this.siteManageService.findAllSections();
  }

  @Post('sections')
  @RequirePermission('module.originals.content.create')
  createSection(@Body() dto: CreateSectionDto) {
    return this.siteManageService.createSection(dto);
  }

  @Patch('sections/:id')
  @RequirePermission('module.originals.content.edit')
  updateSection(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.siteManageService.updateSection(id, dto);
  }

  @Delete('sections/:id')
  @RequirePermission('module.originals.content.delete')
  deleteSection(@Param('id') id: string) {
    return this.siteManageService.deleteSection(id);
  }

  @Put('sections/reorder')
  @RequirePermission('module.originals.content.edit')
  reorderSections(@Body() dto: ReorderDto) {
    return this.siteManageService.reorderSections(dto);
  }

  // ─── Section Slides ─────────────────────────────────────────────

  @Get('sections/:sectionId/slides')
  @RequirePermission('module.originals.content.view')
  findSlidesBySection(@Param('sectionId') sectionId: string) {
    return this.siteManageService.findSlidesBySection(sectionId);
  }

  @Post('sections/:sectionId/slides')
  @RequirePermission('module.originals.content.create')
  createSectionSlide(
    @Param('sectionId') sectionId: string,
    @Body() dto: CreateCarouselSlideDto,
  ) {
    return this.siteManageService.createSlide(dto, sectionId);
  }

  // ─── Hero Slides ────────────────────────────────────────────────

  @Get('hero-slides')
  @RequirePermission('module.originals.content.view')
  findHeroSlides() {
    return this.siteManageService.findHeroSlides();
  }

  @Post('hero-slides')
  @RequirePermission('module.originals.content.create')
  createHeroSlide(@Body() dto: CreateCarouselSlideDto) {
    return this.siteManageService.createSlide(dto);
  }

  // ─── Shared Slide Operations ────────────────────────────────────

  @Patch('slides/:id')
  @RequirePermission('module.originals.content.edit')
  updateSlide(@Param('id') id: string, @Body() dto: UpdateCarouselSlideDto) {
    return this.siteManageService.updateSlide(id, dto);
  }

  @Delete('slides/:id')
  @RequirePermission('module.originals.content.delete')
  deleteSlide(@Param('id') id: string) {
    return this.siteManageService.deleteSlide(id);
  }

  @Put('slides/reorder')
  @RequirePermission('module.originals.content.edit')
  reorderSlides(@Body() dto: ReorderDto) {
    return this.siteManageService.reorderSlides(dto);
  }
}

// ─── Public Controller ──────────────────────────────────────────────

@ApiTags('Originals - Site (Public)')
@Controller('public/originals/site')
export class SiteManagePublicController {
  constructor(private readonly siteManageService: SiteManageService) {}

  @Get('config')
  getPublicSiteConfig() {
    return this.siteManageService.getPublicSiteConfig();
  }
}
