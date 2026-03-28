import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Brackets } from 'typeorm';
import { Article } from './entities/article.entity';
import { Announcement } from './entities/announcement.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { ArticleCategory } from './entities/article-category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    @InjectRepository(ArticleCategory)
    private readonly categoryRepo: Repository<ArticleCategory>,
  ) {}

  // ─── Article Methods ───────────────────────────────────────────────

  async createArticle(dto: CreateArticleDto, authorId: string) {
    let slug = dto.slug;
    if (!slug && dto.title) {
      slug = await this.generateArticleSlug(dto.title);
    }
    if (!slug) slug = `article-${Date.now().toString(36)}`;

    const article = this.articleRepo.create({
      ...dto,
      slug,
      content: dto.content || '',
      authorId,
      publishedAt: dto.status === 'published' ? new Date() : null,
    });
    return this.articleRepo.save(article);
  }

  private async generateArticleSlug(title: string): Promise<string> {
    let base = title.toLowerCase().trim()
      .replace(/[^\w\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (/[\u4e00-\u9fff]/.test(base) || !base) {
      base = `article-${Date.now().toString(36)}`;
    }
    let slug = base;
    let counter = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.articleRepo.findOne({ where: { slug } });
      if (!existing) break;
      slug = `${base}-${counter}`;
      counter++;
    }
    return slug;
  }

  async findAllArticles(page = 1, limit = 20, status?: string) {
    const where: FindOptionsWhere<Article> = {};
    if (status) {
      where.status = status as Article['status'];
    }

    const [items, total] = await this.articleRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { items, total, page, limit };
  }

  async findArticleById(id: string) {
    const article = await this.articleRepo.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  async findArticleBySlug(slug: string) {
    const article = await this.articleRepo.findOne({ where: { slug } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    // Increment view count
    await this.articleRepo.increment({ id: article.id }, 'viewCount', 1);
    article.viewCount += 1;

    return article;
  }

  async updateArticle(id: string, dto: UpdateArticleDto) {
    const article = await this.findArticleById(id);

    // Set publishedAt when transitioning to 'published'
    if (dto.status === 'published' && article.status !== 'published') {
      article.publishedAt = new Date();
    }

    Object.assign(article, dto);
    return this.articleRepo.save(article);
  }

  async deleteArticle(id: string) {
    const article = await this.findArticleById(id);
    await this.articleRepo.remove(article);
  }

  async findPublishedArticles(page = 1, limit = 20, category?: string) {
    const where: FindOptionsWhere<Article> = { status: 'published' };
    if (category) {
      where.category = category as Article['category'];
    }

    const [items, total] = await this.articleRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { isPinned: 'DESC', publishedAt: 'DESC' },
    });

    return { items, total, page, limit };
  }

  // ─── Category Methods ─────────────────────────────────────────────

  async findAllCategories() {
    return this.categoryRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async findActiveCategories() {
    return this.categoryRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const category = this.categoryRepo.create(dto);
    return this.categoryRepo.save(category);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    await this.categoryRepo.remove(category);
  }

  // ─── Article Adjacent (prev/next) ─────────────────────────────────

  async findAdjacentArticles(slug: string) {
    const current = await this.articleRepo.findOne({
      where: { slug, status: 'published' },
    });
    if (!current) throw new NotFoundException('Article not found');

    const prev = await this.articleRepo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: 'published' })
      .andWhere('a.published_at < :date', { date: current.publishedAt })
      .orderBy('a.published_at', 'DESC')
      .select(['a.title', 'a.slug', 'a.coverImageUrl'])
      .getOne();

    const next = await this.articleRepo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: 'published' })
      .andWhere('a.published_at > :date', { date: current.publishedAt })
      .orderBy('a.published_at', 'ASC')
      .select(['a.title', 'a.slug', 'a.coverImageUrl'])
      .getOne();

    return { prev, next };
  }

  // ─── Announcement Methods ──────────────────────────────────────────

  async createAnnouncement(dto: CreateAnnouncementDto, authorId: string) {
    const announcement = this.announcementRepo.create({
      ...dto,
      authorId,
    });
    return this.announcementRepo.save(announcement);
  }

  async findAllAnnouncements(page = 1, limit = 20) {
    const [items, total] = await this.announcementRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { items, total, page, limit };
  }

  async findAnnouncementById(id: string) {
    const announcement = await this.announcementRepo.findOne({
      where: { id },
    });
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  async updateAnnouncement(id: string, dto: UpdateAnnouncementDto) {
    const announcement = await this.findAnnouncementById(id);
    Object.assign(announcement, dto);
    return this.announcementRepo.save(announcement);
  }

  async deleteAnnouncement(id: string) {
    const announcement = await this.findAnnouncementById(id);
    await this.announcementRepo.remove(announcement);
  }

  async findActiveAnnouncements() {
    const now = new Date();

    const items = await this.announcementRepo
      .createQueryBuilder('announcement')
      .where('announcement.is_active = :isActive', { isActive: true })
      .andWhere('announcement.start_time <= :now', { now })
      .andWhere(
        new Brackets((qb) => {
          qb.where('announcement.end_time IS NULL').orWhere(
            'announcement.end_time >= :now',
            { now },
          );
        }),
      )
      .orderBy('announcement.priority', 'DESC')
      .getMany();

    return items;
  }
}
