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

    // 只記錄寫入操作
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = req.user;
    const url = req.originalUrl || req.url;
    const ip = this.extractRealIp(req);
    const body = this.sanitizeBody(req.body);

    return next.handle().pipe(
      tap((responseData) => {
        this.logService.log({
          actorId: user?.sub || null,
          action: `${method} ${url}`,
          resourceType: this.extractResourceType(url),
          resourceId: this.extractResourceId(url),
          details: {
            body,
            actorEmail: user?.email || null,
            ...(responseData && typeof responseData === 'object'
              ? { responseId: (responseData as Record<string, unknown>).id }
              : {}),
          },
          ipAddress: ip,
          userAgent: req.headers['user-agent'],
        });
      }),
    );
  }

  /** 從 X-Forwarded-For 或 X-Real-IP 取得真實客戶端 IP（Zeabur proxy） */
  private extractRealIp(req: Record<string, unknown>): string {
    const headers = req.headers as Record<string, string | string[]>;
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
    const realIp = headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }
    return (req.ip as string) || 'unknown';
  }

  /** 清理請求 body，移除敏感欄位並限制大小 */
  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;
    const sanitized = { ...body };
    // 移除密碼等敏感欄位
    const sensitiveKeys = ['password', 'token', 'secret', 'accessKey', 'secretKey'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '***';
      }
    }
    // 移除過大的欄位（如 file buffer）
    for (const [key, val] of Object.entries(sanitized)) {
      if (val instanceof Buffer || (typeof val === 'string' && val.length > 1000)) {
        sanitized[key] = `[${typeof val === 'string' ? 'string' : 'buffer'}:truncated]`;
      }
    }
    return sanitized;
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
