import { Injectable, Inject, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';
import { PermissionService, PERM_CHANGED_KEY } from '../../permission/permission.service';

export interface JwtPayload {
  sub: string;
  email: string;
  type?: string;
  backendLevel?: string;
  permissions?: string[];
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly permissionService: PermissionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    let permissions = payload.permissions || [];

    // 若該帳號的權限在此 token 簽發後曾被變更，即時從 DB 重抓，
    // 避免管理者改完權限後，對方要等 token 過期才生效。
    try {
      const changedAtRaw = await this.redis.get(PERM_CHANGED_KEY(payload.sub));
      if (changedAtRaw && payload.iat) {
        const changedAt = parseInt(changedAtRaw, 10);
        if (!Number.isNaN(changedAt) && changedAt > payload.iat) {
          permissions = await this.permissionService.findByAccount(payload.sub);
        }
      }
    } catch (err) {
      // Redis 失敗時不阻擋請求，退回使用 JWT 內的權限快照
      this.logger.warn(`Failed to check permission freshness: ${(err as Error).message}`);
    }

    return {
      id: payload.sub,
      email: payload.email,
      type: payload.type,
      backendLevel: payload.backendLevel,
      permissions,
    };
  }
}
