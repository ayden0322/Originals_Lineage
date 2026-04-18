import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamePackage } from './entities/game-package.entity';
import { ModuleConfigService } from '../../../core/module-config/module-config.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { UpdatePackageSettingsDto } from './dto/update-package-settings.dto';
import { ReorderPackagesDto } from './dto/reorder.dto';

const MODULE_CODE = 'originals-lineage';
const SETTINGS_KEY = 'packageSettings';

/** 禮包頁美編預設值 */
export const DEFAULT_PACKAGE_SETTINGS = {
  // Hero
  heroEnabled: true,
  heroTitle: '禮包內容',
  heroSubtitle: '用四海銀票，兌換精選禮包',
  heroBgImageUrl: null as string | null,
  heroHeight: 240,
  heroTextColor: '#ffffff',
  // 貨幣
  currencyName: '四海銀票',
  currencyIconUrl: null as string | null,
  currencyColor: '#c4a24e',
  // 卡片
  cardColumns: 4,
  cardImageRatio: '1:1',
  cardBorderRadius: 12,
  cardBorderColor: 'transparent',
  // 主色
  accentColor: '#c4a24e',
};

export type PackageSettings = typeof DEFAULT_PACKAGE_SETTINGS;

@Injectable()
export class PackageManageService {
  constructor(
    @InjectRepository(GamePackage)
    private readonly packageRepo: Repository<GamePackage>,
    private readonly moduleConfigService: ModuleConfigService,
  ) {}

  // ─── Packages CRUD ─────────────────────────────────────────────

  async findAll() {
    return this.packageRepo.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async findOne(id: string) {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async create(dto: CreatePackageDto) {
    const pkg = this.packageRepo.create({
      ...dto,
      items: dto.items || [],
    });
    return this.packageRepo.save(pkg);
  }

  async update(id: string, dto: UpdatePackageDto) {
    const pkg = await this.findOne(id);
    Object.assign(pkg, dto);
    return this.packageRepo.save(pkg);
  }

  async remove(id: string) {
    const pkg = await this.findOne(id);
    await this.packageRepo.remove(pkg);
  }

  async reorder(dto: ReorderPackagesDto) {
    for (const item of dto.items) {
      await this.packageRepo.update(item.id, { sortOrder: item.sortOrder });
    }
    return this.findAll();
  }

  // ─── Settings (JSONB) ──────────────────────────────────────────

  async getSettings(): Promise<PackageSettings> {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');
    const stored = (config.configJson?.[SETTINGS_KEY] as Partial<PackageSettings>) || {};
    return { ...DEFAULT_PACKAGE_SETTINGS, ...stored };
  }

  async updateSettings(dto: UpdatePackageSettingsDto): Promise<PackageSettings> {
    const config = await this.moduleConfigService.findByCode(MODULE_CODE);
    if (!config) throw new NotFoundException('Module config not found');

    const current = (config.configJson?.[SETTINGS_KEY] as Record<string, unknown>) || {};
    const merged = { ...current, ...dto };
    // null 表示清除
    const packageSettings = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== null),
    );
    const configJson = { ...config.configJson, [SETTINGS_KEY]: packageSettings };
    await this.moduleConfigService.update(MODULE_CODE, { configJson });
    return {
      ...DEFAULT_PACKAGE_SETTINGS,
      ...(packageSettings as Partial<PackageSettings>),
    };
  }

  // ─── Public 聚合 ───────────────────────────────────────────────

  async getPublicConfig() {
    const [settings, packages] = await Promise.all([
      this.getSettings(),
      this.packageRepo.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
    ]);
    return { settings, packages };
  }
}
