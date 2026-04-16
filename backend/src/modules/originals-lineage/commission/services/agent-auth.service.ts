import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Agent } from '../entities/agent.entity';

/**
 * 代理登入服務（給代理後台使用）
 *
 * 簽出的 JWT payload：{ sub: agent.id, type: 'agent', code, parentId }
 * 由 AgentJwtGuard 驗證 type === 'agent' 才放行
 */
@Injectable()
export class AgentAuthService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(loginAccount: string, password: string) {
    // passwordHash 在 entity 設為 select:false，登入驗證需手動選取
    const agent = await this.agentRepo
      .createQueryBuilder('a')
      .addSelect('a.passwordHash')
      .where('a.loginAccount = :loginAccount', { loginAccount })
      .getOne();
    if (!agent || agent.isSystem) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }
    const ok = await bcrypt.compare(password, agent.passwordHash);
    if (!ok) throw new UnauthorizedException('帳號或密碼錯誤');
    if (agent.status !== 'active') {
      throw new ForbiddenException('代理已停權');
    }

    const token = await this.jwtService.signAsync(
      {
        sub: agent.id,
        type: 'agent',
        code: agent.code,
        parentId: agent.parentId,
      },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES', '1d'),
      },
    );

    return {
      accessToken: token,
      agent: {
        id: agent.id,
        code: agent.code,
        name: agent.name,
        parentId: agent.parentId,
        canSetSubRate: agent.canSetSubRate,
        level: agent.parentId ? 2 : 1,
      },
    };
  }
}
