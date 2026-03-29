import { Injectable, ConflictException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Account, BackendLevel } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountService implements OnModuleInit {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async onModuleInit() {
    await this.seedSuperAdmin();
    await this.seedModuleAdmin();
  }

  private async seedSuperAdmin() {
    const email = 'admin@admin.com';
    const existing = await this.accountRepo.findOne({ where: { email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await this.accountRepo.save(
        this.accountRepo.create({
          email,
          passwordHash,
          displayName: '超級管理員',
          backendLevel: BackendLevel.PLATFORM,
        }),
      );
      this.logger.log(`Seed superadmin created: ${email}`);
    }
  }

  private async seedModuleAdmin() {
    const email = 'originals@gmail.com';
    const existing = await this.accountRepo.findOne({ where: { email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash('originals123', 10);
      await this.accountRepo.save(
        this.accountRepo.create({
          email,
          passwordHash,
          displayName: '始祖天堂管理員',
          backendLevel: BackendLevel.MODULE,
        }),
      );
      this.logger.log(`Seed module admin created: ${email}`);
    }
  }

  private sanitize(account: Account) {
    const { passwordHash, refreshTokenHash, ...safe } = account;
    return safe;
  }

  async create(dto: CreateAccountDto) {
    const existing = await this.accountRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const account = this.accountRepo.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      backendLevel: dto.backendLevel,
    });

    return this.sanitize(await this.accountRepo.save(account));
  }

  async findAll(page = 1, limit = 20) {
    const [items, total] = await this.accountRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { items: items.map((a) => this.sanitize(a)), total, page, limit };
  }

  async findById(id: string): Promise<Account> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async findByIdSafe(id: string) {
    return this.sanitize(await this.findById(id));
  }

  async findByEmail(email: string): Promise<Account | null> {
    return this.accountRepo.findOne({ where: { email } });
  }

  async update(id: string, dto: UpdateAccountDto) {
    const account = await this.findById(id);
    Object.assign(account, dto);
    return this.sanitize(await this.accountRepo.save(account));
  }

  async deactivate(id: string) {
    const account = await this.findById(id);
    account.isActive = false;
    return this.sanitize(await this.accountRepo.save(account));
  }

  async updateRefreshTokenHash(id: string, hash: string | null) {
    await this.accountRepo.update(id, { refreshTokenHash: hash });
  }

  async updateLastLogin(id: string) {
    await this.accountRepo.update(id, { lastLoginAt: new Date() });
  }
}
