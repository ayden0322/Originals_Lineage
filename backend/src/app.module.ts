import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './core/auth/auth.module';
import { AccountModule } from './core/account/account.module';
import { PermissionModule } from './core/permission/permission.module';
import { ModuleConfigModule } from './core/module-config/module-config.module';
import { SystemLogModule } from './core/system-log/system-log.module';
import { PaymentModule } from './core/payment/payment.module';
import { StorageModule } from './core/storage/storage.module';
import { OriginalsLineageModule } from './modules/originals-lineage/originals-lineage.module';
import { HealthController } from './health.controller';

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
      }),
    }),

    // Game DB (MySQL) — dynamically managed by GameDbService

    // Event emitter (全域事件系統)
    EventEmitterModule.forRoot(),

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
})
export class AppModule {}
