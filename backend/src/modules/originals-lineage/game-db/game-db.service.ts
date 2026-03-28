import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { ModuleConfigService } from '../../../core/module-config/module-config.service';

export interface GameDbConfig {
  connectionName: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface GameTableMapping {
  tableName: string;
  columns: {
    username: string;
    password: string;
    email: string | null;
    status: string | null;
  };
  passwordEncryption:
    | 'plaintext'
    | 'md5'
    | 'sha1'
    | 'sha256'
    | 'bcrypt';
  hasEmailColumn: boolean;
  hasStatusColumn: boolean;
}

@Injectable()
export class GameDbService implements OnModuleInit {
  private readonly logger = new Logger(GameDbService.name);
  private dataSource: DataSource | null = null;

  constructor(
    private readonly moduleConfigService: ModuleConfigService,
  ) {}

  async onModuleInit() {
    const config =
      await this.moduleConfigService.findByCode('originals-lineage');
    const gameDbConfig = config?.configJson?.['gameDb'] as
      | GameDbConfig
      | undefined;
    if (gameDbConfig?.host) {
      try {
        await this.initializeDataSource(gameDbConfig);
        this.logger.log(
          `Game DB connected: ${gameDbConfig.connectionName || gameDbConfig.host}`,
        );
      } catch (err) {
        this.logger.warn(`Game DB init failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.log('No game DB settings configured, skipping');
    }
  }

  async initializeDataSource(config: GameDbConfig): Promise<void> {
    const oldDs = this.dataSource;

    const newDs = new DataSource({
      type: 'mysql',
      host: config.host,
      port: config.port || 3306,
      username: config.username,
      password: config.password,
      database: config.database,
      synchronize: false,
      connectTimeout: 10000,
    });

    await newDs.initialize();

    // Atomic swap
    this.dataSource = newDs;

    // Destroy old after swap
    if (oldDs?.isInitialized) {
      try {
        await oldDs.destroy();
      } catch (err) {
        this.logger.warn(
          `Error destroying old DataSource: ${(err as Error).message}`,
        );
      }
    }
  }

  async testConnection(
    config: Omit<GameDbConfig, 'connectionName'>,
  ): Promise<boolean> {
    const tempDs = new DataSource({
      type: 'mysql',
      host: config.host,
      port: config.port || 3306,
      username: config.username,
      password: config.password,
      database: config.database,
      synchronize: false,
      connectTimeout: 10000,
    });

    try {
      await tempDs.initialize();
      await tempDs.query('SELECT 1');
      return true;
    } finally {
      if (tempDs.isInitialized) {
        await tempDs.destroy();
      }
    }
  }

  get isConnected(): boolean {
    return this.dataSource?.isInitialized ?? false;
  }

  private ensureConnected(): DataSource {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      throw new BadRequestException(
        '遊戲資料庫未連線，請先在設定頁面配置連線資訊',
      );
    }
    return this.dataSource;
  }

  // ─── Table Mapping ───────────────────────────────────────

  async getTableMapping(): Promise<GameTableMapping | null> {
    const config =
      await this.moduleConfigService.findByCode('originals-lineage');
    return (
      (config?.configJson?.['gameTableMapping'] as GameTableMapping) ??
      null
    );
  }

  async getTableColumns(tableName: string): Promise<string[]> {
    const ds = this.ensureConnected();
    const escapedTableName = tableName.replace(/`/g, '``');
    const rows = await ds.query(
      `SHOW COLUMNS FROM \`${escapedTableName}\``,
    );
    return rows.map((row: any) => row.Field);
  }

  // ─── Password Utilities ──────────────────────────────────

  hashGamePassword(
    plainPassword: string,
    encryption: string,
  ): string {
    switch (encryption) {
      case 'md5':
        return crypto
          .createHash('md5')
          .update(plainPassword)
          .digest('hex');
      case 'sha1':
        return crypto
          .createHash('sha1')
          .update(plainPassword)
          .digest('hex');
      case 'sha256':
        return crypto
          .createHash('sha256')
          .update(plainPassword)
          .digest('hex');
      case 'bcrypt':
        return bcrypt.hashSync(plainPassword, 10);
      case 'plaintext':
      default:
        return plainPassword;
    }
  }

  async verifyGamePassword(
    plainPassword: string,
    storedPassword: string,
  ): Promise<boolean> {
    const mapping = await this.getTableMapping();
    const encryption = mapping?.passwordEncryption || 'plaintext';

    switch (encryption) {
      case 'md5': {
        const hash = crypto
          .createHash('md5')
          .update(plainPassword)
          .digest('hex');
        return hash === storedPassword;
      }
      case 'sha1': {
        const hash = crypto
          .createHash('sha1')
          .update(plainPassword)
          .digest('hex');
        return hash === storedPassword;
      }
      case 'sha256': {
        const hash = crypto
          .createHash('sha256')
          .update(plainPassword)
          .digest('hex');
        return hash === storedPassword;
      }
      case 'bcrypt':
        return bcrypt.compare(plainPassword, storedPassword);
      case 'plaintext':
      default:
        return plainPassword === storedPassword;
    }
  }

  // ─── Game Account Queries ────────────────────────────────

  async findGameAccount(accountName: string) {
    const ds = this.ensureConnected();
    const mapping = await this.getTableMapping();

    if (mapping) {
      const table = mapping.tableName.replace(/`/g, '``');
      const usernameCol = mapping.columns.username.replace(/`/g, '``');
      const result = await ds.query(
        `SELECT * FROM \`${table}\` WHERE \`${usernameCol}\` = ? LIMIT 1`,
        [accountName],
      );
      return result[0] || null;
    }

    // Fallback: 無 mapping 設定時使用預設查詢
    const result = await ds.query(
      'SELECT * FROM accounts WHERE login = ? LIMIT 1',
      [accountName],
    );
    return result[0] || null;
  }

  async createGameAccount(
    accountName: string,
    hashedPassword: string,
  ): Promise<void> {
    const ds = this.ensureConnected();
    const mapping = await this.getTableMapping();

    if (mapping) {
      const table = mapping.tableName.replace(/`/g, '``');
      const usernameCol = mapping.columns.username.replace(/`/g, '``');
      const passwordCol = mapping.columns.password.replace(/`/g, '``');

      const cols = [`\`${usernameCol}\``, `\`${passwordCol}\``];
      const placeholders = ['?', '?'];
      const params: any[] = [accountName, hashedPassword];

      if (mapping.hasEmailColumn && mapping.columns.email) {
        const emailCol = mapping.columns.email.replace(/`/g, '``');
        cols.push(`\`${emailCol}\``);
        placeholders.push('?');
        params.push('');
      }

      if (mapping.hasStatusColumn && mapping.columns.status) {
        const statusCol = mapping.columns.status.replace(/`/g, '``');
        cols.push(`\`${statusCol}\``);
        placeholders.push('?');
        params.push(0);
      }

      await ds.query(
        `INSERT INTO \`${table}\` (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
        params,
      );
    } else {
      // Fallback: 預設 L2J schema
      await ds.query(
        'INSERT INTO accounts (login, password, access_level) VALUES (?, ?, ?)',
        [accountName, hashedPassword, 0],
      );
    }
  }

  async updateGameAccountPassword(
    accountName: string,
    hashedPassword: string,
  ): Promise<void> {
    const ds = this.ensureConnected();
    const mapping = await this.getTableMapping();

    if (mapping) {
      const table = mapping.tableName.replace(/`/g, '``');
      const usernameCol = mapping.columns.username.replace(/`/g, '``');
      const passwordCol = mapping.columns.password.replace(/`/g, '``');

      const result = await ds.query(
        `UPDATE \`${table}\` SET \`${passwordCol}\` = ? WHERE \`${usernameCol}\` = ?`,
        [hashedPassword, accountName],
      );

      if (result.affectedRows === 0) {
        throw new BadRequestException('遊戲帳號不存在，無法更新密碼');
      }
    } else {
      const result = await ds.query(
        'UPDATE accounts SET password = ? WHERE login = ?',
        [hashedPassword, accountName],
      );
      if (result.affectedRows === 0) {
        throw new BadRequestException('遊戲帳號不存在，無法更新密碼');
      }
    }
  }

  async findCharactersByAccount(accountName: string) {
    const ds = this.ensureConnected();
    return ds.query(
      'SELECT * FROM characters WHERE account_name = ?',
      [accountName],
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      const ds = this.ensureConnected();
      await ds.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
