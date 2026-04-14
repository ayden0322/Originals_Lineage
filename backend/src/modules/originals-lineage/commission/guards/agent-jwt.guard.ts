import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';

/**
 * 代理 JWT 守衛
 * - 沿用 JwtAuthGuard 的 token 驗證
 * - 額外檢查 payload.type === 'agent'，避免管理者 token 誤用代理 API
 */
@Injectable()
export class AgentJwtGuard extends JwtAuthGuard {
  handleRequest<TUser = any>(err: any, user: any, info: any, _ctx: ExecutionContext): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException();
    }
    if (user.type !== 'agent') {
      throw new UnauthorizedException('需要代理身份');
    }
    return user as TUser;
  }
}
