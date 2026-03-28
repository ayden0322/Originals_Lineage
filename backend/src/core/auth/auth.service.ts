import {
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { AccountService } from '../account/account.service';
import { PermissionService } from '../permission/permission.service';
import { REDIS_CLIENT } from '../database/redis.module';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly accountService: AccountService,
    private readonly permissionService: PermissionService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async login(dto: LoginDto) {
    const account = await this.accountService.findByEmail(dto.email);
    if (!account || !account.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, account.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const permissions = await this.permissionService.findByAccount(account.id);
    const tokens = await this.generateTokens(account.id, account.email, account.backendLevel, permissions);

    // Store refresh token hash
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.accountService.updateRefreshTokenHash(account.id, refreshHash);
    await this.accountService.updateLastLogin(account.id);

    return tokens;
  }

  async refresh(userId: string, refreshToken: string) {
    const account = await this.accountService.findById(userId);
    if (!account || !account.isActive || !account.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.redis.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const isValid = await bcrypt.compare(refreshToken, account.refreshTokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const permissions = await this.permissionService.findByAccount(account.id);
    const tokens = await this.generateTokens(account.id, account.email, account.backendLevel, permissions);

    // Update stored refresh token hash
    const newHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.accountService.updateRefreshTokenHash(account.id, newHash);

    return tokens;
  }

  async logout(userId: string) {
    // Clear stored refresh token — invalidates all refresh attempts
    await this.accountService.updateRefreshTokenHash(userId, null);
  }

  async getProfile(userId: string) {
    const account = await this.accountService.findById(userId);
    const { passwordHash, refreshTokenHash, ...profile } = account;
    return profile;
  }

  private async generateTokens(userId: string, email: string, backendLevel: string, permissions: string[] = []) {
    const payload: JwtPayload = {
      sub: userId,
      email,
      type: 'platform-admin',
      backendLevel,
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

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 604800; // default 7 days
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 604800;
    }
  }
}
