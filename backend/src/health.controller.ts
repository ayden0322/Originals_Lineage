import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 即時查詢 TypeORM pg Pool 狀態；
   * 管理員回報卡頓時立即打這支看 waiting 是否 > 0，可現場判斷池是否滿。
   * 回傳欄位：
   *   total   目前連線總數
   *   idle    閒置中（可立即使用）
   *   waiting 正在等連線的請求數（>0 即警訊）
   *   max     池上限
   */
  @Get('db-pool')
  dbPool() {
    const pool = (this.dataSource.driver as any)?.master;
    if (!pool || typeof pool.totalCount !== 'number') {
      return { available: false };
    }
    return {
      available: true,
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
      max: pool.options?.max ?? null,
    };
  }
}
