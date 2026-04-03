import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'line_id', type: 'varchar', nullable: true })
  lineId: string | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'verification_code', type: 'varchar', nullable: true })
  verificationCode: string | null;

  @Column({ name: 'verification_code_expires_at', type: 'timestamp', nullable: true })
  verificationCodeExpiresAt: Date | null;

  @Column({ type: 'varchar', default: 'registered' })
  status: 'registered' | 'confirmed' | 'converted';

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
