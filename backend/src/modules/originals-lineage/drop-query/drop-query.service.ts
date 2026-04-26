import { Injectable, NotFoundException } from '@nestjs/common';
import { GameDbService } from '../game-db/game-db.service';

/**
 * 始祖天堂遊戲庫掉落查詢
 *
 * 三張關鍵表（皆為 MyISAM，唯讀查詢）：
 *  - droplist (mobId, itemId, min, max, chance, note) — chance 單位為百萬分之一 (1000000=100%)
 *  - spawnlist (npc_templateid, count, ...)            — count=0 視為「未開放」
 *  - spawnlist_boss (npc_templateid, count, ...)       — 同上，boss 專用
 *
 * 開放/關閉的兩層判定（每次查詢都即時從 DB 讀，調 DB 即時生效）：
 *  1. 怪物層：spawnlist / spawnlist_boss 任一筆 count>0 視為怪物開放
 *  2. 掉落層：droplist 該筆 max>0 視為該道具實際會掉
 *     (min=max=0 是「掉落開關」用法 — 紀錄保留但暫停掉落，調整數值即可重新開放)
 *
 * 道具名稱來源拆三表：etcitem / weapon / armor，item_id 互不重疊。
 * etcitem.name 含 L1J 顏色控制碼 \f.（兩字元一組），需過濾。
 *
 * 效能注意：npc 表約 230 萬筆。MySQL 對 `npcid IN (UNION subquery)` 不一定會
 * 做 semi-join 優化，可能退化成相關子查詢逐列重算 UNION，造成 timeout。
 * 因此 active 怪物清單一律以 derived table（INNER JOIN）方式提供。
 */
@Injectable()
export class DropQueryService {
  constructor(private readonly gameDb: GameDbService) {}

  // ─── 內部工具 ────────────────────────────────────────────

  private cleanName(name: string | null | undefined): string {
    if (!name) return '';
    return name.replace(/\\f./g, '');
  }

  /** 「目前有開放」的 mob id 清單（spawnlist 或 spawnlist_boss 至少一筆 count>0）。 */
  private readonly activeMobsDerived = `(
    SELECT DISTINCT npc_templateid AS npcid FROM spawnlist      WHERE count > 0
    UNION
    SELECT DISTINCT npc_templateid AS npcid FROM spawnlist_boss WHERE count > 0
  )`;

  /** Boss 中目前有開放的 mob id 清單（用來判斷 isBoss 標籤）。 */
  private readonly activeBossDerived = `(
    SELECT DISTINCT npc_templateid AS npcid FROM spawnlist_boss WHERE count > 0
  )`;

  /** 三張道具表 UNION（itemId / rawName / itemType） */
  private readonly allItemsUnion = `(
    SELECT e.item_id AS itemId, e.name AS rawName, 'etc'    AS itemType FROM etcitem e
    UNION ALL
    SELECT w.item_id AS itemId, w.name AS rawName, 'weapon' AS itemType FROM weapon  w
    UNION ALL
    SELECT a.item_id AS itemId, a.name AS rawName, 'armor'  AS itemType FROM armor   a
  )`;

  // ─── 道具搜尋 ────────────────────────────────────────────

  /**
   * 搜尋「目前有開放怪物會掉」且名稱含關鍵字的道具。
   * 條件：itemId 出現在 droplist 且該筆 droplist 的 mobId 是目前開放怪物。
   */
  async searchItems(
    keyword: string,
    page: number,
    limit: number,
  ): Promise<{
    items: Array<{ itemId: number; itemName: string; itemType: 'etc' | 'weapon' | 'armor' }>;
    total: number;
  }> {
    const offset = Math.max(0, (page - 1) * limit);
    const kw = (keyword || '').trim();
    const likeParam = `%${kw}%`;

    const baseFrom = `
      FROM ${this.allItemsUnion} i
      INNER JOIN (
        SELECT DISTINCT d.itemId
        FROM droplist d
        INNER JOIN ${this.activeMobsDerived} active ON active.npcid = d.mobId
        WHERE d.max > 0
      ) d ON d.itemId = i.itemId
    `;
    const where = kw ? 'WHERE i.rawName LIKE ?' : '';
    const params: unknown[] = kw ? [likeParam] : [];

    const [rows, countRows] = await Promise.all([
      this.gameDb.runQuery<
        Array<{ itemId: number; rawName: string; itemType: 'etc' | 'weapon' | 'armor' }>
      >(
        `SELECT i.itemId, i.rawName, i.itemType ${baseFrom} ${where}
         ORDER BY i.itemId ASC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      this.gameDb.runQuery<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total ${baseFrom} ${where}`,
        params,
      ),
    ]);

    return {
      items: rows.map((r) => ({
        itemId: Number(r.itemId),
        itemName: this.cleanName(r.rawName) || `未知道具#${r.itemId}`,
        itemType: r.itemType,
      })),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  // ─── 怪物搜尋（只列目前有開放的） ────────────────────────

  async searchMonsters(
    keyword: string,
    page: number,
    limit: number,
  ): Promise<{
    items: Array<{ npcid: number; name: string; isBoss: boolean }>;
    total: number;
  }> {
    const offset = Math.max(0, (page - 1) * limit);
    const kw = (keyword || '').trim();
    const likeParam = `%${kw}%`;

    const where = kw ? 'WHERE n.name LIKE ?' : '';
    const params: unknown[] = kw ? [likeParam] : [];

    // INNER JOIN active derived table，避免 npc(2.3M 筆) 上的 IN (UNION) 退化為相關子查詢
    const [rows, countRows] = await Promise.all([
      this.gameDb.runQuery<Array<{ npcid: number; name: string; isBoss: number | string }>>(
        `SELECT n.npcid, n.name,
                CASE WHEN sb.npcid IS NOT NULL THEN 1 ELSE 0 END AS isBoss
         FROM npc n
         INNER JOIN ${this.activeMobsDerived} active ON active.npcid = n.npcid
         LEFT  JOIN ${this.activeBossDerived} sb     ON sb.npcid     = n.npcid
         ${where}
         ORDER BY n.npcid ASC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      this.gameDb.runQuery<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total
         FROM npc n
         INNER JOIN ${this.activeMobsDerived} active ON active.npcid = n.npcid
         ${where}`,
        params,
      ),
    ]);

    return {
      items: rows.map((r) => ({
        npcid: Number(r.npcid),
        name: r.name,
        isBoss: Number(r.isBoss) === 1,
      })),
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  // ─── 道具反查怪物 ────────────────────────────────────────

  /** 給 itemId，列出所有「目前有開放」的怪物；含掉落數量（依機率高到低排）。 */
  async getMonstersDroppingItem(itemId: number): Promise<{
    item: { itemId: number; itemName: string; itemType: 'etc' | 'weapon' | 'armor' } | null;
    monsters: Array<{
      npcid: number;
      name: string;
      isBoss: boolean;
      min: number;
      max: number;
      chancePercent: number;
      note: string;
    }>;
  }> {
    const itemRows = await this.gameDb.runQuery<
      Array<{ itemId: number; rawName: string; itemType: 'etc' | 'weapon' | 'armor' }>
    >(
      `SELECT i.itemId, i.rawName, i.itemType
       FROM ${this.allItemsUnion} i
       WHERE i.itemId = ? LIMIT 1`,
      [itemId],
    );

    const item =
      itemRows.length > 0
        ? {
            itemId: Number(itemRows[0].itemId),
            itemName:
              this.cleanName(itemRows[0].rawName) || `未知道具#${itemRows[0].itemId}`,
            itemType: itemRows[0].itemType,
          }
        : null;

    const monsterRows = await this.gameDb.runQuery<
      Array<{
        mobId: number;
        name: string;
        min: number;
        max: number;
        chance: number;
        note: string;
        isBoss: number | string;
      }>
    >(
      `SELECT d.mobId, n.name, d.min, d.max, d.chance, d.note,
              CASE WHEN sb.npcid IS NOT NULL THEN 1 ELSE 0 END AS isBoss
       FROM droplist d
       INNER JOIN npc n                                  ON n.npcid     = d.mobId
       INNER JOIN ${this.activeMobsDerived} active       ON active.npcid = d.mobId
       LEFT  JOIN ${this.activeBossDerived} sb           ON sb.npcid    = d.mobId
       WHERE d.itemId = ? AND d.max > 0
       ORDER BY d.chance DESC`,
      [itemId],
    );

    return {
      item,
      monsters: monsterRows.map((r) => ({
        npcid: Number(r.mobId),
        name: r.name,
        isBoss: Number(r.isBoss) === 1,
        min: Number(r.min),
        max: Number(r.max),
        chancePercent: Number(r.chance) / 10000,
        note: r.note || '',
      })),
    };
  }

  // ─── 怪物反查道具 ────────────────────────────────────────

  /** 給 npcid，列出該怪物所有掉落物。先驗證怪物存在且有開放，否則 404。 */
  async getDropsByMonster(npcid: number): Promise<{
    monster: { npcid: number; name: string; isBoss: boolean };
    drops: Array<{
      itemId: number;
      itemName: string;
      itemType: 'etc' | 'weapon' | 'armor' | 'unknown';
      min: number;
      max: number;
      chancePercent: number;
      note: string;
    }>;
  }> {
    const guard = await this.gameDb.runQuery<
      Array<{ npcid: number; name: string; isBoss: number | string }>
    >(
      `SELECT n.npcid, n.name,
              CASE WHEN sb.npcid IS NOT NULL THEN 1 ELSE 0 END AS isBoss
       FROM npc n
       INNER JOIN ${this.activeMobsDerived} active ON active.npcid = n.npcid
       LEFT  JOIN ${this.activeBossDerived} sb     ON sb.npcid     = n.npcid
       WHERE n.npcid = ?
       LIMIT 1`,
      [npcid],
    );

    if (guard.length === 0) {
      throw new NotFoundException('查無此怪物或目前未開放');
    }

    const dropRows = await this.gameDb.runQuery<
      Array<{
        itemId: number;
        min: number;
        max: number;
        chance: number;
        note: string;
        etcName: string | null;
        weaName: string | null;
        armName: string | null;
        itemType: 'etc' | 'weapon' | 'armor' | 'unknown';
      }>
    >(
      `SELECT d.itemId, d.min, d.max, d.chance, d.note,
              e.name AS etcName, w.name AS weaName, a.name AS armName,
              CASE WHEN e.item_id IS NOT NULL THEN 'etc'
                   WHEN w.item_id IS NOT NULL THEN 'weapon'
                   WHEN a.item_id IS NOT NULL THEN 'armor'
                   ELSE 'unknown' END AS itemType
       FROM droplist d
       LEFT JOIN etcitem e ON e.item_id = d.itemId
       LEFT JOIN weapon  w ON w.item_id = d.itemId
       LEFT JOIN armor   a ON a.item_id = d.itemId
       WHERE d.mobId = ? AND d.max > 0
       ORDER BY d.chance DESC`,
      [npcid],
    );

    return {
      monster: {
        npcid: Number(guard[0].npcid),
        name: guard[0].name,
        isBoss: Number(guard[0].isBoss) === 1,
      },
      drops: dropRows.map((r) => {
        const rawName = r.etcName || r.weaName || r.armName || '';
        return {
          itemId: Number(r.itemId),
          itemName: this.cleanName(rawName) || `未知道具#${r.itemId}`,
          itemType: r.itemType,
          min: Number(r.min),
          max: Number(r.max),
          chancePercent: Number(r.chance) / 10000,
          note: r.note || '',
        };
      }),
    };
  }
}
