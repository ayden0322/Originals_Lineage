import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ModuleAdmin } from './module-admin.entity';
import { Permission } from '../../../../core/permission/entities/permission.entity';

@Entity('module_admin_permissions')
@Unique(['moduleAdminId', 'permissionId'])
export class ModuleAdminPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'module_admin_id' })
  moduleAdminId: string;

  @Column({ name: 'permission_id' })
  permissionId: string;

  @Column({ name: 'granted_by', type: 'varchar', nullable: true })
  grantedBy: string | null;

  @ManyToOne(() => ModuleAdmin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_admin_id' })
  moduleAdmin: ModuleAdmin;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
