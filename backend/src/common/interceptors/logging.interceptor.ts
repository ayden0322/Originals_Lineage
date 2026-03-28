import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SystemLogService } from '../../core/system-log/system-log.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logService: SystemLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    // Only log write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = req.user;
    const url = req.originalUrl || req.url;

    return next.handle().pipe(
      tap(() => {
        this.logService.log({
          actorId: user?.sub || null,
          action: `${method} ${url}`,
          resourceType: this.extractResourceType(url),
          resourceId: this.extractResourceId(url),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }),
    );
  }

  private extractResourceType(url: string): string {
    const parts = url.replace(/^\/api\//, '').split('/');
    return parts[0] || 'unknown';
  }

  private extractResourceId(url: string): string | undefined {
    const uuidMatch = url.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    return uuidMatch?.[1];
  }
}
