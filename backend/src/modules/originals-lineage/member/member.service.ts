import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { WebsiteUser } from './entities/website-user.entity';
import { MemberBinding } from './entities/member-binding.entity';
import { GameDbService } from '../game-db/game-db.service';
import { SystemLogService } from '../../../core/system-log/system-log.service';
import { CreateWebsiteUserDto } from './dto/create-website-user.dto';
import { BindGameAccountDto } from './dto/bind-game-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeSecondPasswordDto } from './dto/change-second-password.dto';

@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(WebsiteUser)
    private readonly userRepo: Repository<WebsiteUser>,

    @InjectRepository(MemberBinding)
    private readonly bindingRepo: Repository<MemberBinding>,

    private readonly gameDbService: GameDbService,
    private readonly systemLogService: SystemLogService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
    const secondPasswordHash = await bcrypt.hash(dto.secondPassword, 10);

    const user = this.userRepo.create({
      gameAccountName: dto.gameAccountName,
      passwordHash,
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

    // 5. Return safe user data
    const {
      passwordHash: _ph,
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

    const tokens = await this.generatePlayerTokens(user.id, user.email ?? '');

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

    // 3. Hash new password for website (bcrypt)
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

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

  async findAllMembers(page: number = 1, limit: number = 20) {
    const [users, total] = await this.userRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: users.map((user) => {
        const {
          passwordHash,
          refreshTokenHash,
          secondPasswordHash,
          ...safeUser
        } = user;
        return safeUser;
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
    return {
      id: user.id,
      gameAccountName: user.gameAccountName,
      email: user.email,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
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

  private async generatePlayerTokens(userId: string, email: string) {
    const payload = {
      sub: userId,
      email,
      type: 'player',
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
