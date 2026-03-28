import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ModuleAdmin } from './entities/module-admin.entity';
import { ModuleAdminPermission } from './entities/module-admin-permission.entity';
import { Permission } from '../../../core/permission/entities/permission.entity';
import { ModuleAdminService } from './module-admin.service';
import { ModuleAdminAuthService } from './module-admin-auth.service';
import { ModuleAdminAuthController } from './module-admin-auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModuleAdmin, ModuleAdminPermission, Permission]),
    JwtModule.register({}),
  ],
  controllers: [ModuleAdminAuthController],
  providers: [ModuleAdminService, ModuleAdminAuthService],
  exports: [ModuleAdminService],
})
export class ModuleAdminModule {}
