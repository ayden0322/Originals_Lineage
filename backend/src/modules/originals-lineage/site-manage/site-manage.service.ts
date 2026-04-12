import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SiteSection } from './entities/site-section.entity';
import { CarouselSlide } from './entities/carousel-slide.entity';
import { ModuleConfigService } from '../../../core/module-config/module-config.service';
import { ContentService } from '../content/content.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateCarouselSlideDto } from './dto/create-carousel-slide.dto';
import { UpdateCarouselSlideDto } from './dto/update-carousel-slide.dto';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { ReorderDto } from './dto/reorder.dto';

const MODULE_CODE = 'originals-lineage';

@Injectable()
export class SiteManageService {
  constructor(
    @InjectRepository(SiteSection)
    private readonly sectionRepo: Repository<SiteSection>,
    @InjectRepository(CarouselSlide)
    private readonly slideRepo: Repository<CarouselSlide>,
    private readonly moduleConfigService: ModuleConfigService,
    private readonly contentService: ContentService,
  ) {}

  // ─── Site Settings ──────────────────────────────────────────────────

  async getSiteSettings() {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');
    return config.configJson?.['siteSettings'] || {
      siteName: '始祖天堂',
      siteSlogan: '無盡傳奇再啟',
      siteDescription: '跨越時光，重返懷念的世界。事前預約、最新消息、線上商城一次掌握。',
      logoUrl: null,
      footerText: '始祖天堂 © 2026',
      heroEnabled: true,
      newsDisplayCount: 5,
      featuredArticleIds: [],
    };
  }

  async updateSiteSettings(dto: UpdateSiteSettingsDto) {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');

    const current = config.configJson?.['siteSettings'] || {};
    const merged = { ...current, ...dto };
    // 將值為 null 的欄位從設定中移除（前端傳 null 表示要清除）
    const siteSettings = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== null),
    );
    const configJson = { ...config.configJson, siteSettings };
    await this.moduleConfigService.update(MODULE_CODE, { configJson });
    return siteSettings;
  }

  // ─── Sections ───────────────────────────────────────────────────────

  async findAllSections() {
    return this.sectionRepo.find({
      order: { sortOrder: 'ASC' },
      relations: ['slides'],
    });
  }

  async createSection(dto: CreateSectionDto) {
    const slug = await this.generateUniqueSlug(dto.name);
    const section = this.sectionRepo.create({
      ...dto,
      slug,
      displayName: dto.name,
    });
    return this.sectionRepo.save(section);
  }

  async findSectionById(id: string) {
    const section = await this.sectionRepo.findOne({
      where: { id },
      relations: ['slides'],
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    const section = await this.findSectionById(id);
    if (dto.name && dto.name !== section.name) {
      section.slug = await this.generateUniqueSlug(dto.name, id);
      section.displayName = dto.name;
    }
    Object.assign(section, dto);
    return this.sectionRepo.save(section);
  }

  async deleteSection(id: string) {
    const section = await this.findSectionById(id);
    await this.sectionRepo.remove(section);
  }

  async reorderSections(dto: ReorderDto) {
    for (const item of dto.items) {
      await this.sectionRepo.update(item.id, { sortOrder: item.sortOrder });
    }
    return this.findAllSections();
  }

  // ─── Carousel Slides ────────────────────────────────────────────────

  async findSlidesBySection(sectionId: string) {
    return this.slideRepo.find({
      where: { sectionId },
      order: { sortOrder: 'ASC' },
    });
  }

  async findHeroSlides() {
    return this.slideRepo.find({
      where: { sectionId: IsNull() },
      order: { sortOrder: 'ASC' },
    });
  }

  async createSlide(dto: CreateCarouselSlideDto, sectionId?: string) {
    const slide = this.slideRepo.create({
      ...dto,
      sectionId: sectionId || null,
    });
    return this.slideRepo.save(slide);
  }

  async findSlideById(id: string) {
    const slide = await this.slideRepo.findOne({ where: { id } });
    if (!slide) throw new NotFoundException('Slide not found');
    return slide;
  }

  async updateSlide(id: string, dto: UpdateCarouselSlideDto) {
    const slide = await this.findSlideById(id);
    Object.assign(slide, dto);
    return this.slideRepo.save(slide);
  }

  async deleteSlide(id: string) {
    const slide = await this.findSlideById(id);
    await this.slideRepo.remove(slide);
  }

  async reorderSlides(dto: ReorderDto) {
    for (const item of dto.items) {
      await this.slideRepo.update(item.id, { sortOrder: item.sortOrder });
    }
  }

  // ─── Slug Generation ───────────────────────────────────────────────

  private async generateUniqueSlug(
    name: string,
    excludeId?: string,
  ): Promise<string> {
    // Convert Chinese/special chars to pinyin-like slug, or use as-is for ASCII
    let base = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\u4e00-\u9fff]+/g, '-') // keep word chars and CJK
      .replace(/^-+|-+$/g, '');

    // For CJK characters, use a timestamp-based suffix to ensure uniqueness
    if (/[\u4e00-\u9fff]/.test(base)) {
      base = `section-${Date.now().toString(36)}`;
    }

    if (!base) base = `section-${Date.now().toString(36)}`;

    let slug = base;
    let counter = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.sectionRepo.findOne({ where: { slug } });
      if (!existing || existing.id === excludeId) break;
      slug = `${base}-${counter}`;
      counter++;
    }
    return slug;
  }

  // ─── Public Site Config (aggregated) ────────────────────────────────

  async getPublicSiteConfig() {
    const settings = await this.getSiteSettings();

    const heroSlides = await this.slideRepo.find({
      where: { sectionId: IsNull(), isActive: true },
      order: { sortOrder: 'ASC' },
    });

    const sections = await this.sectionRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
      relations: ['slides'],
    });

    // Filter inactive slides from sections
    const activeSections = sections.map((section) => ({
      ...section,
      slides: (section.slides || [])
        .filter((s) => s.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));

    // Fetch featured articles
    let featuredArticles: unknown[] = [];
    const siteSettings = settings as { featuredArticleIds?: string[] };
    const articleIds: string[] = siteSettings.featuredArticleIds || [];
    if (articleIds.length > 0) {
      const promises = articleIds.map((id: string) =>
        this.contentService.findArticleById(id).catch(() => null),
      );
      const results = await Promise.all(promises);
      featuredArticles = results.filter(
        (a): a is NonNullable<typeof a> => a !== null && (a as { status: string }).status === 'published',
      );
    }

    return {
      settings,
      heroSlides,
      sections: activeSections,
      featuredArticles,
    };
  }
}
