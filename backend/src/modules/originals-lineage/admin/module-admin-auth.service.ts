import {
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { ModuleAdminService } from './module-admin.service';
import { REDIS_CLIENT } from '../../../core/database/redis.module';
import { LoginDto } from '../../../core/auth/dto/login.dto';

@Injectable()
export class ModuleAdminAuthService {
  constructor(
    private readonly moduleAdminService: ModuleAdminService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async login(dto: LoginDto) {
    const admin = await this.moduleAdminService.findByEmail(dto.email);
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    const permissions = await this.moduleAdminService.findPermissions(admin.id);
    const tokens = await this.generateTokens(admin.id, admin.email, permissions);

    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.moduleAdminService.updateRefreshTokenHash(admin.id, refreshHash);
    await this.moduleAdminService.updateLastLogin(admin.id);

    return tokens;
  }

  async refresh(userId: string, refreshToken: string) {
    const admin = await this.moduleAdminService.findById(userId);
    if (!admin || !admin.isActive || !admin.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isBlacklisted = await this.redis.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const isValid = await bcrypt.compare(refreshToken, admin.refreshTokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const permissions = await this.moduleAdminService.findPermissions(admin.id);
    const tokens = await this.generateTokens(admin.id, admin.email, permissions);

    const newHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.moduleAdminService.updateRefreshTokenHash(admin.id, newHash);

    return tokens;
  }

  async logout(userId: string) {
    await this.moduleAdminService.updateRefreshTokenHash(userId, null);
  }

  async getProfile(userId: string) {
    const admin = await this.moduleAdminService.findById(userId);
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }
    const { passwordHash, refreshTokenHash, ...profile } = admin;
    const permissions = await this.moduleAdminService.findPermissions(admin.id);
    return { ...profile, permissions };
  }

  private async generateTokens(userId: string, email: string, permissions: string[] = []) {
    const payload = {
      sub: userId,
      email,
      type: 'module-admin',
      backendLevel: 'module',
      permissions,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRY', '15m'),
      }),
      this.jwtService.signAsync(
        { sub: userId, email },
        {
          secret: this.config.get('JWT_REFRESH_SECRET'),
          expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}
