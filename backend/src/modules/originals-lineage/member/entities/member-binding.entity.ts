import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('member_bindings')
export class MemberBinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'website_account_id', unique: true })
  websiteAccountId: string;

  @Column({ name: 'game_account_name' })
  gameAccountName: string;

  @Column({ name: 'game_character_id', type: 'int', nullable: true })
  gameCharacterId: number | null;

  @Column({
    name: 'binding_status',
    type: 'varchar',
    default: 'pending',
  })
  bindingStatus: 'pending' | 'verified' | 'unbound';

  @Column({ name: 'bound_at', type: 'timestamp', nullable: true })
  boundAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
