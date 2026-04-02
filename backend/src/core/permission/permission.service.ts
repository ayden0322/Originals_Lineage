import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { AccountPermission } from './entities/account-permission.entity';
import { Account, BackendLevel } from '../account/entities/account.entity';

// Permission seed definitions
const PERMISSION_SEEDS = [
  // Platform-level
  { code: 'platform.accounts.view', name: '查看帳號', backendLevel: 'platform', moduleCode: null, category: '帳號管理' },
  { code: 'platform.accounts.create', name: '建立帳號', backendLevel: 'platform', moduleCode: null, category: '帳號管理' },
  { code: 'platform.accounts.edit', name: '編輯帳號', backendLevel: 'platform', moduleCode: null, category: '帳號管理' },
  { code: 'platform.accounts.delete', name: '停用帳號', backendLevel: 'platform', moduleCode: null, category: '帳號管理' },
  { code: 'platform.permissions.manage', name: '管理權限', backendLevel: 'platform', moduleCode: null, category: '權限管理' },
  { code: 'platform.modules.manage', name: '管理模組', backendLevel: 'platform', moduleCode: null, category: '模組管理' },
  { code: 'platform.logs.view', name: '查看日誌', backendLevel: 'platform', moduleCode: null, category: '系統日誌' },
  { code: 'platform.transactions.view', name: '查看交易總覽', backendLevel: 'platform', moduleCode: null, category: '金流管理' },

  // Module: originals-lineage
  { code: 'module.originals.members.view', name: '查看會員', backendLevel: 'module', moduleCode: 'originals-lineage', category: '會員管理' },
  { code: 'module.originals.members.edit', name: '編輯會員', backendLevel: 'module', moduleCode: 'originals-lineage', category: '會員管理' },
  { code: 'module.originals.content.view', name: '查看內容', backendLevel: 'module', moduleCode: 'originals-lineage', category: '內容管理' },
  { code: 'module.originals.content.create', name: '建立內容', backendLevel: 'module', moduleCode: 'originals-lineage', category: '內容管理' },
  { code: 'module.originals.content.edit', name: '編輯內容', backendLevel: 'module', moduleCode: 'originals-lineage', category: '內容管理' },
  { code: 'module.originals.content.delete', name: '刪除內容', backendLevel: 'module', moduleCode: 'originals-lineage', category: '內容管理' },
  { code: 'module.originals.shop.view', name: '查看商城', backendLevel: 'module', moduleCode: 'originals-lineage', category: '商城管理' },
  { code: 'module.originals.shop.manage', name: '管理商城', backendLevel: 'module', moduleCode: 'originals-lineage', category: '商城管理' },
  { code: 'module.originals.reserve.view', name: '查看預約', backendLevel: 'module', moduleCode: 'originals-lineage', category: '預約管理' },
  { code: 'module.originals.reserve.manage', name: '管理預約', backendLevel: 'module', moduleCode: 'originals-lineage', category: '預約管理' },
  { code: 'module.originals.orders.view', name: '查看訂單', backendLevel: 'module', moduleCode: 'originals-lineage', category: '訂單管理' },
  { code: 'module.originals.orders.manage', name: '管理訂單', backendLevel: 'module', moduleCode: 'originals-lineage', category: '訂單管理' },
  { code: 'module.originals.settings.manage', name: '管理模組設定', backendLevel: 'module', moduleCode: 'originals-lineage', category: '模組設定' },
  { code: 'module.originals.clan.manage', name: '管理血盟', backendLevel: 'module', moduleCode: 'originals-lineage', category: '血盟管理' },
  { code: 'module.originals.media.view', name: '查看媒體庫', backendLevel: 'module', moduleCode: 'originals-lineage', category: '媒體管理' },
  { code: 'module.originals.media.manage', name: '管理媒體庫', backendLevel: 'module', moduleCode: 'originals-lineage', category: '媒體管理' },
  { code: 'module.originals.logs.view', name: '查看操作日誌', backendLevel: 'module', moduleCode: 'originals-lineage', category: '操作日誌' },
];

@Injectable()
export class PermissionService implements OnModuleInit {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(AccountPermission)
    private readonly accountPermRepo: Repository<AccountPermission>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async onModuleInit() {
    await this.seedPermissions();
    await this.seedSuperAdminPermissions();
    await this.seedModuleAdminPermissions();
  }

  private async seedPermissions() {
    for (const seed of PERMISSION_SEEDS) {
      const existing = await this.permissionRepo.findOne({
        where: { code: seed.code },
      });
      if (!existing) {
        await this.permissionRepo.save(
          this.permissionRepo.create(seed),
        );
      }
    }
  }

  private async seedSuperAdminPermissions() {
    const superAdmin = await this.accountRepo.findOne({
      where: { email: 'admin@admin.com', backendLevel: BackendLevel.PLATFORM },
    });
    if (!superAdmin) return;

    const allPermissions = await this.permissionRepo.find();
    const existingPerms = await this.accountPermRepo.find({
      where: { accountId: superAdmin.id },
    });
    const existingIds = new Set(existingPerms.map((p) => p.permissionId));

    let added = 0;
    for (const perm of allPermissions) {
      if (!existingIds.has(perm.id)) {
        await this.accountPermRepo.save(
          this.accountPermRepo.create({
            accountId: superAdmin.id,
            permissionId: perm.id,
            grantedBy: superAdmin.id,
          }),
        );
        added++;
      }
    }
    if (added > 0) {
      this.logger.log(`Assigned ${added} permissions to superadmin`);
    }
  }

  private async seedModuleAdminPermissions() {
    const moduleAdmin = await this.accountRepo.findOne({
      where: { email: 'originals@gmail.com', backendLevel: BackendLevel.MODULE },
    });
    if (!moduleAdmin) return;

    // 取得所有 module 級別權限
    const modulePermissions = await this.permissionRepo.find({
      where: { backendLevel: 'module' },
    });
    const existingPerms = await this.accountPermRepo.find({
      where: { accountId: moduleAdmin.id },
    });
    const existingIds = new Set(existingPerms.map((p) => p.permissionId));

    let added = 0;
    for (const perm of modulePermissions) {
      if (!existingIds.has(perm.id)) {
        await this.accountPermRepo.save(
          this.accountPermRepo.create({
            accountId: moduleAdmin.id,
            permissionId: perm.id,
            grantedBy: moduleAdmin.id,
          }),
        );
        added++;
      }
    }
    if (added > 0) {
      this.logger.log(`Assigned ${added} module permissions to originals@gmail.com`);
    }
  }

  async findAll() {
    return this.permissionRepo.find({ order: { category: 'ASC', sortOrder: 'ASC' } });
  }

  async findByAccount(accountId: string): Promise<string[]> {
    const records = await this.accountPermRepo.find({
      where: { accountId },
      relations: ['permission'],
    });
    return records.map((r) => r.permission.code);
  }

  async assignPermissions(accountId: string, permissionCodes: string[], grantedBy: string) {
    const permissions = await this.permissionRepo.find();
    const codeToId = new Map(permissions.map((p) => [p.code, p.id]));

    for (const code of permissionCodes) {
      const permissionId = codeToId.get(code);
      if (!permissionId) continue;

      const existing = await this.accountPermRepo.findOne({
        where: { accountId, permissionId },
      });
      if (!existing) {
        await this.accountPermRepo.save(
          this.accountPermRepo.create({ accountId, permissionId, grantedBy }),
        );
      }
    }
  }

  async revokePermissions(accountId: string, permissionCodes: string[]) {
    const permissions = await this.permissionRepo.find();
    const codeToId = new Map(permissions.map((p) => [p.code, p.id]));

    for (const code of permissionCodes) {
      const permissionId = codeToId.get(code);
      if (!permissionId) continue;
      await this.accountPermRepo.delete({ accountId, permissionId });
    }
  }

  async getGroupedPermissions() {
    const all = await this.findAll();
    const grouped: Record<string, Permission[]> = {};
    for (const p of all) {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    }
    return grouped;
  }
}
