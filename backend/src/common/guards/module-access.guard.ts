import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ModuleConfigService } from '../../core/module-config/module-config.service';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(private readonly moduleConfigService: ModuleConfigService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest();

    // Extract module code from URL path (e.g., /api/modules/originals/...)
    const path: string = request.route?.path || request.url || '';
    const match = path.match(/\/modules\/([^/]+)/);
    if (!match) return true; // Not a module route

    const moduleCode = match[1];
    const config = await this.moduleConfigService.findByCode(moduleCode);

    if (!config || !config.isActive) {
      throw new ForbiddenException('Module is not active');
    }

    return true;
  }
}
