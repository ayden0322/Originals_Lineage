import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MemberBinding } from './member-binding.entity';

@Entity('website_users')
export class WebsiteUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ name: 'game_account_name', unique: true })
  gameAccountName: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'second_password_hash' })
  secondPasswordHash: string;

  @Column({ name: 'second_password_plain', type: 'varchar', nullable: true })
  secondPasswordPlain: string | null;

  @Column({ name: 'display_name', type: 'varchar', nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'line_id', type: 'varchar', nullable: true })
  lineId: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'refresh_token_hash', type: 'varchar', nullable: true })
  refreshTokenHash: string | null;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Virtual property mapped via LEFT JOIN in query
  binding?: MemberBinding;
}
