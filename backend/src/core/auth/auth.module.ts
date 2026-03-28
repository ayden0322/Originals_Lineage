import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { AccountModule } from '../account/account.module';
import { RedisModule } from '../database/redis.module';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    AccountModule,
    RedisModule,
    PermissionModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
