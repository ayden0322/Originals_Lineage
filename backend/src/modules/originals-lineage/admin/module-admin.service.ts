import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ModuleAdmin } from './entities/module-admin.entity';
import { ModuleAdminPermission } from './entities/module-admin-permission.entity';
import { Permission } from '../../../core/permission/entities/permission.entity';

@Injectable()
export class ModuleAdminService implements OnModuleInit {
  private readonly logger = new Logger(ModuleAdminService.name);

  constructor(
    @InjectRepository(ModuleAdmin)
    private readonly adminRepo: Repository<ModuleAdmin>,
    @InjectRepository(ModuleAdminPermission)
    private readonly adminPermRepo: Repository<ModuleAdminPermission>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  async onModuleInit() {
    await this.seedModuleAdmin();
  }

  private async seedModuleAdmin() {
    const email = 'originals@gmail.com';
    const existing = await this.adminRepo.findOne({ where: { email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash('originals123', 10);
      const admin = await this.adminRepo.save(
        this.adminRepo.create({
          email,
          passwordHash,
          displayName: '始祖天堂管理員',
        }),
      );
      this.logger.log(`Seed module admin created: ${email}`);

      // Assign all originals-lineage module permissions
      await this.seedModuleAdminPermissions(admin);
    } else {
      // Ensure permissions are up-to-date
      await this.seedModuleAdminPermissions(existing);
    }
  }

  private async seedModuleAdminPermissions(admin: ModuleAdmin) {
    const modulePermissions = await this.permissionRepo.find({
      where: { moduleCode: 'originals-lineage' },
    });

    const existingPerms = await this.adminPermRepo.find({
      where: { moduleAdminId: admin.id },
    });
    const existingIds = new Set(existingPerms.map((p) => p.permissionId));

    let added = 0;
    for (const perm of modulePermissions) {
      if (!existingIds.has(perm.id)) {
        await this.adminPermRepo.save(
          this.adminPermRepo.create({
            moduleAdminId: admin.id,
            permissionId: perm.id,
            grantedBy: admin.id,
          }),
        );
        added++;
      }
    }
    if (added > 0) {
      this.logger.log(`Assigned ${added} permissions to module admin`);
    }
  }

  async findByEmail(email: string) {
    return this.adminRepo.findOne({ where: { email } });
  }

  async findById(id: string) {
    return this.adminRepo.findOne({ where: { id } });
  }

  async findByIdSafe(id: string) {
    const admin = await this.adminRepo.findOne({ where: { id } });
    if (!admin) return null;
    const { passwordHash, refreshTokenHash, ...safe } = admin;
    return safe;
  }

  async findPermissions(moduleAdminId: string): Promise<string[]> {
    const records = await this.adminPermRepo.find({
      where: { moduleAdminId },
      relations: ['permission'],
    });
    return records.map((r) => r.permission.code);
  }

  async updateRefreshTokenHash(id: string, hash: string | null) {
    await this.adminRepo.update(id, { refreshTokenHash: hash });
  }

  async updateLastLogin(id: string) {
    await this.adminRepo.update(id, { lastLoginAt: new Date() });
  }
}
