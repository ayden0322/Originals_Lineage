import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * 慢 API 監測：任何 request 花費超過門檻就 warn。
 * 配合 DbPoolMonitorService、Postgres 慢查詢 log 三者時間戳對照，可追到根因。
 * 不修改回應內容，只負責觀測與記錄。
 */
const SLOW_THRESHOLD_MS = 1000;

@Injectable()
export class SlowRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SlowReq');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.maybeLog(req, start, false),
        error: () => this.maybeLog(req, start, true),
      }),
    );
  }

  private maybeLog(req: any, start: number, failed: boolean) {
    const ms = Date.now() - start;
    if (ms < SLOW_THRESHOLD_MS) return;
    const method = req.method;
    const url = req.originalUrl || req.url;
    this.logger.warn(`${failed ? 'ERR ' : ''}${method} ${url} ${ms}ms`);
  }
}
