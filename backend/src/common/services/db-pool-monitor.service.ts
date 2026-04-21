import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * 週期性檢查 TypeORM 底層 pg Pool 的狀態；
 * 當連線池接近飽和（有請求在等、或完全沒閒置）時印 warn，
 * 讓 Zeabur log 留下「何時池滿」的時間戳證據。
 *
 * 不做通知、不殺 query，只負責觀測。
 */
const CHECK_INTERVAL_MS = 30_000;

@Injectable()
export class DbPoolMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('DbPool');
  private timer?: NodeJS.Timeout;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit() {
    this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private check() {
    const pool = (this.dataSource.driver as any)?.master;
    if (!pool || typeof pool.totalCount !== 'number') return;

    const { totalCount, idleCount, waitingCount } = pool;

    // 接近飽和條件：有人在等、或已有連線但全部忙碌
    if (waitingCount > 0 || (totalCount > 0 && idleCount === 0)) {
      this.logger.warn(
        `near-saturation total=${totalCount} idle=${idleCount} waiting=${waitingCount}`,
      );
    }
  }
}
