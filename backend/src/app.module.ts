import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './core/auth/auth.module';
import { AccountModule } from './core/account/account.module';
import { PermissionModule } from './core/permission/permission.module';
import { ModuleConfigModule } from './core/module-config/module-config.module';
import { SystemLogModule } from './core/system-log/system-log.module';
import { PaymentModule } from './core/payment/payment.module';
import { StorageModule } from './core/storage/storage.module';
import { OriginalsLineageModule } from './modules/originals-lineage/originals-lineage.module';
import { HealthController } from './health.controller';
import { DbPoolMonitorService } from './common/services/db-pool-monitor.service';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Platform DB (PostgreSQL) - default connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('POSTGRES_HOST'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.get('POSTGRES_USER'),
        password: config.get('POSTGRES_PASSWORD'),
        database: config.get('POSTGRES_DB'),
        autoLoadEntities: true,
        synchronize: config.get('TYPEORM_SYNC', 'false') === 'true' || config.get('NODE_ENV') === 'development',
        logging: config.get('NODE_ENV') === 'development',
        // pg Pool 參數（node-postgres 透過 extra 傳入）：
        //   max 原預設 10 偏緊，拉到 20。需確保 DB max_connections 接得住（pool×pod + 其他連線 < 上限）。
        //   connectionTimeoutMillis 讓等不到連線時改為 3s 拋錯，避免前端無限跑圈圈、使用者能看到錯誤訊息、後端能收到 5xx 告警。
        extra: {
          max: 20,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 3_000,
        },
      }),
    }),

    // Game DB (MySQL) — dynamically managed by GameDbService

    // Event emitter (全域事件系統)
    EventEmitterModule.forRoot(),

    // Rate limiting：全域預設 100 req/min/IP，登入/註冊端點用 @Throttle 收緊
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Core modules
    AuthModule,
    AccountModule,
    PermissionModule,
    ModuleConfigModule,
    SystemLogModule,
    PaymentModule,
    StorageModule,

    // Game modules
    OriginalsLineageModule,
  ],
  controllers: [HealthController],
  providers: [
    DbPoolMonitorService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
