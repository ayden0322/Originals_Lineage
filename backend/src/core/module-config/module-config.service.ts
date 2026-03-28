import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleConfig } from './entities/module-config.entity';

@Injectable()
export class ModuleConfigService implements OnModuleInit {
  constructor(
    @InjectRepository(ModuleConfig)
    private readonly repo: Repository<ModuleConfig>,
  ) {}

  async onModuleInit() {
    // Seed default module: originals-lineage
    const existing = await this.repo.findOne({
      where: { moduleCode: 'originals-lineage' },
    });
    if (!existing) {
      await this.repo.save(
        this.repo.create({
          moduleCode: 'originals-lineage',
          moduleName: '始祖天堂',
          isActive: true,
          paymentEnabled: true,
          lineBotEnabled: true,
        }),
      );
    }
  }

  async findAll() {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async findByCode(code: string): Promise<ModuleConfig | null> {
    return this.repo.findOne({ where: { moduleCode: code } });
  }

  async update(code: string, data: Partial<ModuleConfig>): Promise<ModuleConfig> {
    const config = await this.findByCode(code);
    if (!config) throw new NotFoundException('Module not found');
    Object.assign(config, data);
    return this.repo.save(config);
  }

  async togglePayment(code: string): Promise<ModuleConfig> {
    const config = await this.findByCode(code);
    if (!config) throw new NotFoundException('Module not found');
    config.paymentEnabled = !config.paymentEnabled;
    return this.repo.save(config);
  }

  async toggleLineBot(code: string): Promise<ModuleConfig> {
    const config = await this.findByCode(code);
    if (!config) throw new NotFoundException('Module not found');
    config.lineBotEnabled = !config.lineBotEnabled;
    return this.repo.save(config);
  }
}
