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

  /**
   * 防呆檢查：在非 production 環境下若連到「非本機」的 game DB（通常代表正式環境），
   * 印出醒目警告。這條不會擋住連線（接正式庫測試是合法用例），
   * 但確保開發者啟動 / 切換連線時都能看到「我現在連到正式庫了」。
   */
  private warnIfConnectingToProdInDev(config: GameDbConfig): void {
    const isProd = process.env.NODE_ENV === 'production';
    const localHosts = new Set([
      'localhost',
      '127.0.0.1',
      '::1',
      'mysql',
      'mysql-dev',
      'originals-mysql-dev',
    ]);
    if (!isProd && !localHosts.has(config.host)) {
      const banner = '⚠️ '.repeat(20);
      this.logger.warn(banner);
      this.logger.warn(
        `[GameDB] DEV 環境正在連接「非本機」遊戲資料庫：${config.host}:${config.port || 3306}/${config.database} (user=${config.username})`,
      );
      this.logger.warn(
        '[GameDB] 任何寫入操作（鑽石儲值、獎勵發送）都會直接影響該資料庫，請確認這是你的本意！',
      );
      this.logger.warn(banner);
    } else {
      this.logger.log(
        `[GameDB] 連接 ${config.host}:${config.port || 3306}/${config.database}`,
      );
    }
  }

  async initializeDataSource(config: GameDbConfig): Promise<void> {
    this.warnIfConnectingToProdInDev(config);

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

  /**
   * 批次查角色 + 血盟名稱（供玩家歸屬列表顯示）
   * 一個遊戲帳號只有一個角色，回傳 Map<account_name, { charName, clanName }>
   * 遊戲庫未連線時回傳空 Map（不拋錯，讓上游優雅降級）
   */
  async findCharacterClanByAccounts(
    accountNames: string[],
  ): Promise<Map<string, { charName: string; clanName: string | null }>> {
    const result = new Map<
      string,
      { charName: string; clanName: string | null }
    >();
    if (!this.isConnected || accountNames.length === 0) return result;

    const ds = this.dataSource!;
    const placeholders = accountNames.map(() => '?').join(',');
    try {
      const rows = (await ds.query(
        `SELECT c.account_name, c.char_name, cl.clan_name
         FROM characters c
         LEFT JOIN clan_data cl ON cl.clan_id = c.ClanID
         WHERE c.account_name IN (${placeholders})`,
        accountNames,
      )) as Array<{
        account_name: string;
        char_name: string;
        clan_name: string | null;
      }>;

      for (const row of rows) {
        result.set(row.account_name, {
          charName: row.char_name,
          clanName: row.clan_name ?? null,
        });
      }
    } catch (err) {
      this.logger.warn(
        `findCharacterClanByAccounts failed: ${(err as Error).message}`,
      );
    }
    return result;
  }

  // ─── Shop / 商城專用 ─────────────────────────────────────

  /**
   * 查詢遊戲物品（etcitem.item_id > 6000000）
   * 供後台新增商品時選擇遊戲禮包/月卡用
   */
  async findGameItems(
    search: string | undefined,
    page: number,
    limit: number,
  ): Promise<{ items: Array<{ itemId: number; name: string }>; total: number }> {
    const ds = this.ensureConnected();
    const offset = (page - 1) * limit;

    const where: string[] = ['item_id > 6000000'];
    const params: unknown[] = [];
    if (search) {
      where.push('name LIKE ?');
      params.push(`%${search}%`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [rows, countRows] = await Promise.all([
      ds.query(
        `SELECT item_id, name FROM etcitem ${whereSql} ORDER BY item_id ASC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      ds.query(
        `SELECT COUNT(*) AS total FROM etcitem ${whereSql}`,
        params,
      ),
    ]);

    return {
      items: (rows as Array<{ item_id: number; name: string }>).map((r) => ({
        itemId: r.item_id,
        // 過濾 L2J 顏色控制碼：\f 後面接任一字元（例如 \f=、\fD、\f3、\fY ...）
        name: (r.name || '').replace(/\\f./g, ''),
      })),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  /**
   * 取得帳號下角色的最高等級（用於商品等級限制檢查）
   * 找不到角色回傳 0
   */
  async getMaxLevelByAccount(accountName: string): Promise<number> {
    const ds = this.ensureConnected();
    const rows = await ds.query(
      'SELECT MAX(level) AS max_level FROM characters WHERE account_name = ?',
      [accountName],
    );
    const value = (rows as Array<{ max_level: number | null }>)[0]?.max_level;
    return value == null ? 0 : Number(value);
  }

  /**
   * 寫入鑽石儲值記錄 → ancestor.贊助_儲值記錄
   * 對應規則：p_id=44070, count=diamondAmount, trueMoney=1, out=0, ready=1
   */
  async insertDiamondTopup(
    accountName: string,
    diamondAmount: number,
  ): Promise<number> {
    const ds = this.ensureConnected();
    const result = await ds.query(
      `INSERT INTO \`贊助_儲值記錄\`
        (p_id, p_name, count, account, \`out\`, play, play_clanname, time, ip, ready, trueMoney)
       VALUES (44070, NULL, ?, ?, 0, NULL, NULL, NULL, NULL, 1, 1)`,
      [diamondAmount, accountName],
    );
    return (result as { insertId: number }).insertId;
  }

  /**
   * 寫入遊戲禮包/月卡發送記錄 → ancestor.輔助_獎勵發送
   * 強化值固定 0，是否已送出=0，是否已經可以領取=1
   */
  async insertGiftReward(
    accountName: string,
    itemId: number,
    itemName: string,
    quantity: number,
  ): Promise<number> {
    const ds = this.ensureConnected();
    const result = await ds.query(
      `INSERT INTO \`輔助_獎勵發送\`
        (\`獎勵道具編號\`, \`獎勵道具名稱\`, \`強化值\`, \`獎勵道具數量\`,
         \`指定發送玩家帳號\`, \`是否已送出\`, \`領取人名稱\`, \`領取時間\`,
         \`領取人ip\`, \`是否已經可以領取\`)
       VALUES (?, ?, 0, ?, ?, 0, NULL, NULL, NULL, 1)`,
      [itemId, itemName, quantity, accountName],
    );
    return (result as { insertId: number }).insertId;
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
