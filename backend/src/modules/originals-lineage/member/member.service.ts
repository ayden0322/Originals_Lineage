import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  Brackets,
  Between,
  MoreThanOrEqual,
  LessThan,
} from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { WebsiteUser } from './entities/website-user.entity';
import { MemberBinding } from './entities/member-binding.entity';
import { Order } from '../shop/entities/order.entity';
import { Product } from '../shop/entities/product.entity';
import { GameDbService } from '../game-db/game-db.service';
import { SystemLogService } from '../../../core/system-log/system-log.service';
import { AttributionService } from '../commission/services/attribution.service';
import { CreateWebsiteUserDto } from './dto/create-website-user.dto';
import { BindGameAccountDto } from './dto/bind-game-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeSecondPasswordDto } from './dto/change-second-password.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { encryptPassword } from './utils/password-crypto';

@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(WebsiteUser)
    private readonly userRepo: Repository<WebsiteUser>,

    @InjectRepository(MemberBinding)
    private readonly bindingRepo: Repository<MemberBinding>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly gameDbService: GameDbService,
    private readonly systemLogService: SystemLogService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly attribution: AttributionService,
  ) {}

  // ─── Player Registration (Unified Account) ──────────────────────────

  async register(dto: CreateWebsiteUserDto) {
    // 1. Check gameAccountName uniqueness in website_users
    const existingGameName = await this.userRepo.findOne({
      where: { gameAccountName: dto.gameAccountName },
    });
    if (existingGameName) {
      throw new ConflictException('此遊戲帳號已被其他官網帳號註冊');
    }

    // 2. Check game DB for existing account
    const gameAccount = await this.gameDbService.findGameAccount(
      dto.gameAccountName,
    );
    const mapping = await this.gameDbService.getTableMapping();
    const encryption = mapping?.passwordEncryption || 'plaintext';

    if (gameAccount) {
      // ─── EXISTING PLAYER FLOW ─────────────────────────────
      // Verify game password (dto.password = existing game password)
      const passwordCol = mapping?.columns?.password || 'password';
      const storedGamePassword = gameAccount[passwordCol];
      const isValidGamePw = await this.gameDbService.verifyGamePassword(
        dto.password,
        storedGamePassword,
      );
      if (!isValidGamePw) {
        throw new UnauthorizedException('遊戲密碼驗證失敗');
      }
      // Game DB password stays as-is, website password syncs to the same value
    } else {
      // ─── NEW PLAYER FLOW ──────────────────────────────────
      // 新玩家強制密碼長度政策（既有玩家走驗證路徑，密碼長度由遊戲端舊資料決定，不在此處限制）
      if (dto.password.length < 6) {
        throw new BadRequestException('密碼至少 6 位');
      }
      // Create game account with the given password
      const gamePasswordHash = this.gameDbService.hashGamePassword(
        dto.password,
        encryption,
      );
      await this.gameDbService.createGameAccount(
        dto.gameAccountName,
        gamePasswordHash,
      );
    }

    // 3. Create WebsiteUser (password = game password, auto-synced)
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const passwordEncrypted = encryptPassword(dto.password);
    const secondPasswordHash = await bcrypt.hash(dto.secondPassword, 10);

    const user = this.userRepo.create({
      gameAccountName: dto.gameAccountName,
      passwordHash,
      passwordEncrypted,
      secondPasswordHash,
      secondPasswordPlain: dto.secondPassword,
      email: null,
      displayName: null,
      phone: null,
    });

    let saved: WebsiteUser;
    try {
      saved = await this.userRepo.save(user);
    } catch (error: any) {
      // Handle race condition: duplicate key on gameAccountName
      if (
        error.code === '23505' ||
        error.message?.includes('duplicate key')
      ) {
        throw new ConflictException('此遊戲帳號已被註冊');
      }
      throw error;
    }

    // 4. Auto-create MemberBinding with status 'verified'
    const binding = this.bindingRepo.create({
      websiteAccountId: saved.id,
      gameAccountName: dto.gameAccountName,
      bindingStatus: 'verified',
      boundAt: new Date(),
    });
    await this.bindingRepo.save(binding);

    // 5. 綁定代理歸屬（refCode 來自前端的 ref_code Cookie；無則歸 SYSTEM）
    await this.attribution.attributeOnRegister({
      playerId: saved.id,
      refCode: dto.refCode,
      source: 'cookie',
    });

    // 6. Return safe user data
    const {
      passwordHash: _ph,
      passwordEncrypted: _pe,
      refreshTokenHash: _rt,
      secondPasswordHash: _sph,
      secondPasswordPlain: _spp,
      ...result
    } = saved;
    return result;
  }

  // ─── Check Game Account ─────────────────────────────────────────────

  async checkGameAccount(gameAccountName: string) {
    // Check if already claimed on website
    const existingUser = await this.userRepo.findOne({
      where: { gameAccountName },
    });
    if (existingUser) {
      throw new ConflictException('此遊戲帳號已被其他官網帳號註冊');
    }

    // Check if exists in game DB
    const gameAccount =
      await this.gameDbService.findGameAccount(gameAccountName);

    return {
      exists: !!gameAccount,
      message: gameAccount
        ? '此遊戲帳號已存在，請輸入遊戲密碼進行驗證'
        : '此遊戲帳號可以使用，將為您創建新帳號',
    };
  }

  // ─── Player Login ─────────────────────────────────────────────────

  async loginPlayer(gameAccountName: string, password: string) {
    const user = await this.userRepo.findOne({ where: { gameAccountName } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    const tokens = await this.generatePlayerTokens(user.id, user.email ?? '', user.gameAccountName);

    // Store refresh token hash
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    user.refreshTokenHash = refreshHash;
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    return tokens;
  }

  // ─── Second Password Verification ──────────────────────────────────

  async verifySecondPassword(
    userId: string,
    secondPassword: string,
  ): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('使用者不存在');
    }

    const isValid = await bcrypt.compare(
      secondPassword,
      user.secondPasswordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('第二組密碼驗證失敗');
    }

    return true;
  }

  // ─── Change Password (Sync to Game DB) ─────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    // 1. Verify second password
    await this.verifySecondPassword(userId, dto.secondPassword);

    // 2. Get user to find gameAccountName
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('使用者不存在');
    }

    // 3. Hash + encrypt new password for website
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    const newPasswordEncrypted = encryptPassword(dto.newPassword);

    // 4. Hash new password for game DB (using configured encryption)
    const mapping = await this.gameDbService.getTableMapping();
    const encryption = mapping?.passwordEncryption || 'plaintext';
    const gamePasswordHash = this.gameDbService.hashGamePassword(
      dto.newPassword,
      encryption,
    );

    // 5. Update game DB first (external system)
    await this.gameDbService.updateGameAccountPassword(
      user.gameAccountName,
      gamePasswordHash,
    );

    // 6. Update website user
    user.passwordHash = newPasswordHash;
    user.passwordEncrypted = newPasswordEncrypted;
    await this.userRepo.save(user);

    return { message: '密碼已成功更新' };
  }

  // ─── Bind Game Account (Legacy — kept for backward compat) ─────────

  async bindGameAccount(userId: string, dto: BindGameAccountDto) {
    const existingBinding = await this.bindingRepo.findOne({
      where: { websiteAccountId: userId },
    });
    if (existingBinding) {
      throw new ConflictException('Account already has a game binding');
    }

    const gameAccount = await this.gameDbService.findGameAccount(
      dto.gameAccountName,
    );
    if (!gameAccount) {
      throw new BadRequestException('Game account not found');
    }

    const binding = this.bindingRepo.create({
      websiteAccountId: userId,
      gameAccountName: dto.gameAccountName,
      bindingStatus: 'pending',
    });

    return this.bindingRepo.save(binding);
  }

  // ─── Player: Get My Binding ───────────────────────────────────────

  async getMyBinding(userId: string) {
    const binding = await this.bindingRepo.findOne({
      where: { websiteAccountId: userId },
    });
    return binding || null;
  }

  // ─── Admin: List All Members ──────────────────────────────────────

  async findAllMembers(query: ListMembersQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const keyword = query.keyword?.trim();

    const qb = this.userRepo.createQueryBuilder('u');

    // 狀態篩選
    if (query.isActive === 'true') {
      qb.andWhere('u.is_active = :active', { active: true });
    } else if (query.isActive === 'false') {
      qb.andWhere('u.is_active = :active', { active: false });
    }

    // 註冊時間區間
    if (query.registeredFrom) {
      qb.andWhere('u.created_at >= :rFrom', { rFrom: query.registeredFrom });
    }
    if (query.registeredTo) {
      qb.andWhere('u.created_at < :rTo', { rTo: query.registeredTo });
    }

    // 關鍵字：先比主庫欄位；若可能匹配角色名，反查遊戲庫取得帳號清單後 union
    if (keyword) {
      const gameAccountMatches =
        await this.gameDbService.findAccountNamesByCharOrClan(keyword);

      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('u.game_account_name ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('u.email ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('u.display_name ILIKE :kw', { kw: `%${keyword}%` });
          if (gameAccountMatches.length > 0) {
            sub.orWhere('u.game_account_name IN (:...accts)', {
              accts: gameAccountMatches,
            });
          }
        }),
      );
    }

    // 血盟篩選（精確）：反查遊戲庫拿到帳號清單後限定範圍
    if (query.clanName) {
      const clanAccounts =
        await this.gameDbService.findAccountNamesByClan(query.clanName);
      if (clanAccounts.length === 0) {
        // 該血盟無人 → 直接回空
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
      qb.andWhere('u.game_account_name IN (:...clanAccts)', {
        clanAccts: clanAccounts,
      });
    }

    qb.orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await qb.getManyAndCount();

    // 批次查角色/血盟（一帳號一角色）
    const accountNames = users.map((u) => u.gameAccountName).filter(Boolean);
    const charClanMap = await this.gameDbService.findCharacterClanByAccounts(
      Array.from(new Set(accountNames)),
    );

    const items = users.map((user) => {
      const {
        passwordHash,
        passwordEncrypted,
        refreshTokenHash,
        secondPasswordHash,
        ...safeUser
      } = user;
      const hit = charClanMap.get(user.gameAccountName);
      return {
        ...safeUser,
        charName: hit?.charName ?? null,
        clanName: hit?.clanName ?? null,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Admin: List Clans (for filter dropdown) ──────────────────

  async listClans() {
    return this.gameDbService.findAllClans();
  }

  // ─── Admin: Member Recharge / Order History ────────────────────

  async findMemberOrders(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      status?: string;
    } = {},
  ) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('使用者不存在');
    }

    const binding = await this.bindingRepo.findOne({
      where: { websiteAccountId: userId },
    });

    if (!binding) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        summary: { totalPaid: 0, paidCount: 0 },
      };
    }

    const where: Record<string, unknown> = { memberBindingId: binding.id };
    if (options.status) {
      where.status = options.status;
    }
    if (options.from && options.to) {
      where.createdAt = Between(new Date(options.from), new Date(options.to));
    } else if (options.from) {
      where.createdAt = MoreThanOrEqual(new Date(options.from));
    } else if (options.to) {
      where.createdAt = LessThan(new Date(options.to));
    }

    const [orders, total] = await this.orderRepo.findAndCount({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 商品名稱填充
    const productIds = Array.from(
      new Set(orders.flatMap((o) => o.items.map((i) => i.productId))),
    );
    const productMap = new Map<string, string>();
    if (productIds.length > 0) {
      const products = await this.productRepo.find({
        where: { id: In(productIds) },
      });
      for (const p of products) {
        productMap.set(p.id, p.name);
      }
    }

    // 已付款統計（不受分頁/狀態篩選影響，用同樣 from/to 範圍的 paid 總額）
    const summaryWhere: Record<string, unknown> = {
      memberBindingId: binding.id,
      status: 'paid',
    };
    if (options.from && options.to) {
      summaryWhere.createdAt = Between(
        new Date(options.from),
        new Date(options.to),
      );
    } else if (options.from) {
      summaryWhere.createdAt = MoreThanOrEqual(new Date(options.from));
    } else if (options.to) {
      summaryWhere.createdAt = LessThan(new Date(options.to));
    }
    const paidOrders = await this.orderRepo.find({ where: summaryWhere });
    const totalPaid = paidOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );

    return {
      items: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: Number(o.totalAmount),
        status: o.status,
        paymentTransactionId: o.paymentTransactionId,
        deliveryStatus: o.deliveryStatus,
        createdAt: o.createdAt,
        items: o.items.map((i) => ({
          productId: i.productId,
          productName: productMap.get(i.productId) ?? '(已刪除商品)',
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          diamondAmount: i.diamondAmount,
        })),
      })),
      total,
      page,
      limit,
      summary: {
        totalPaid,
        paidCount: paidOrders.length,
      },
    };
  }

  // ─── Admin: Get Single Binding ────────────────────────────────────

  async findBindingById(id: string) {
    const binding = await this.bindingRepo.findOne({ where: { id } });
    if (!binding) {
      throw new NotFoundException('Binding not found');
    }
    return binding;
  }

  // ─── Admin: Update Binding Status ─────────────────────────────────

  async updateBindingStatus(
    id: string,
    status: 'pending' | 'verified' | 'unbound',
  ) {
    const binding = await this.findBindingById(id);

    binding.bindingStatus = status;
    if (status === 'verified') {
      binding.boundAt = new Date();
    }

    return this.bindingRepo.save(binding);
  }

  // ─── Player: Get Profile ─────────────────────────────────────────

  async getPlayerProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('使用者不存在');
    }

    // 遊戲庫未連線時會回空 Map，charName/clanName 會是 null（降級）
    const charClanMap = await this.gameDbService.findCharacterClanByAccounts(
      [user.gameAccountName],
    );
    const hit = charClanMap.get(user.gameAccountName);

    return {
      id: user.id,
      gameAccountName: user.gameAccountName,
      email: user.email,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      charName: hit?.charName ?? null,
      clanName: hit?.clanName ?? null,
    };
  }

  // ─── Player: Change Second Password ─────────────────────────────

  async changeSecondPassword(userId: string, dto: ChangeSecondPasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('使用者不存在');
    }

    // 1. Verify game password
    const isValidPw = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPw) {
      throw new UnauthorizedException('遊戲密碼驗證失敗');
    }

    // 2. Verify current second password
    const isValidSecond = await bcrypt.compare(
      dto.currentSecondPassword,
      user.secondPasswordHash,
    );
    if (!isValidSecond) {
      throw new UnauthorizedException('當前第二組密碼驗證失敗');
    }

    // 3. Update second password (hash + plain)
    const oldPlain = user.secondPasswordPlain;
    user.secondPasswordHash = await bcrypt.hash(dto.newSecondPassword, 10);
    user.secondPasswordPlain = dto.newSecondPassword;
    await this.userRepo.save(user);

    // 4. Log the change
    await this.systemLogService.log({
      actorId: userId,
      action: 'change-second-password',
      resourceType: 'website-user',
      resourceId: userId,
      details: {
        changedBy: 'player',
        gameAccountName: user.gameAccountName,
        oldSecondPassword: oldPlain,
        newSecondPassword: dto.newSecondPassword,
      },
    });

    return { message: '第二組密碼已成功更新' };
  }

  // ─── Admin: Reset Second Password ──────────────────────────────

  async adminResetSecondPassword(
    userId: string,
    newSecondPassword: string,
    adminId: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('使用者不存在');
    }

    const oldPlain = user.secondPasswordPlain;
    user.secondPasswordHash = await bcrypt.hash(newSecondPassword, 10);
    user.secondPasswordPlain = newSecondPassword;
    await this.userRepo.save(user);

    // Log the change
    await this.systemLogService.log({
      actorId: adminId,
      action: 'admin-reset-second-password',
      resourceType: 'website-user',
      resourceId: userId,
      details: {
        changedBy: 'admin',
        gameAccountName: user.gameAccountName,
        oldSecondPassword: oldPlain,
        newSecondPassword,
      },
    });

    return { message: '第二組密碼已重設成功' };
  }

  // ─── Admin: Get Second Password Logs ───────────────────────────

  async getSecondPasswordLogs(userId: string) {
    const logs = await this.systemLogService.findByResource(
      'website-user',
      userId,
      ['change-second-password', 'admin-reset-second-password'],
    );
    return logs;
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private async generatePlayerTokens(userId: string, email: string, gameAccountName: string) {
    const payload = {
      sub: userId,
      email,
      type: 'player',
      gameAccountName,
    };

    // Player token TTL 與後台 admin 分開：玩家逛商城時段較長，預設 2h；
    // 後台 admin 仍維持 15m（透過 JWT_ACCESS_EXPIRY 控制）。
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get('PLAYER_JWT_ACCESS_EXPIRY', '2h'),
      }),
      this.jwtService.signAsync(
        { sub: userId, email, type: 'player' },
        {
          secret: this.configService.get('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get('JWT_REFRESH_EXPIRY', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}
