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
 * 道具名稱來源拆三表：etcitem / weapon / armor，item_id 互不重疊。
 * etcitem.name 含 L1J 顏色控制碼 \f.（兩字元一組），需過濾。
 */
@Injectable()
export class DropQueryService {
  constructor(private readonly gameDb: GameDbService) {}

  // ─── 內部工具 ────────────────────────────────────────────

  private cleanName(name: string | null | undefined): string {
    if (!name) return '';
    return name.replace(/\\f./g, '');
  }

  /** 「目前有開放」的 mob id 集合（spawnlist 或 spawnlist_boss 至少一筆 count>0）。 */
  private readonly activeMobsCte = `(
    SELECT DISTINCT npc_templateid AS npcid FROM spawnlist      WHERE count > 0
    UNION
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
   * 搜尋「在 droplist 中至少出現過一次」且名稱含關鍵字的道具。
   * 為避免列出根本不會掉的道具（武器/防具/etcitem 還包含商城品、合成材料等大量無用 ID），
   * 一律以 droplist 為過濾條件。
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
      INNER JOIN (SELECT DISTINCT itemId FROM droplist) d ON d.itemId = i.itemId
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

    const where: string[] = [`n.npcid IN ${this.activeMobsCte}`];
    const params: unknown[] = [];
    if (kw) {
      where.push('n.name LIKE ?');
      params.push(likeParam);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [rows, countRows] = await Promise.all([
      this.gameDb.runQuery<Array<{ npcid: number; name: string; isBoss: number | string }>>(
        `SELECT n.npcid, n.name,
                EXISTS(SELECT 1 FROM spawnlist_boss sb WHERE sb.npc_templateid = n.npcid AND sb.count > 0) AS isBoss
         FROM npc n
         ${whereSql}
         ORDER BY n.npcid ASC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      this.gameDb.runQuery<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total FROM npc n ${whereSql}`,
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

  /** 給 itemId，列出所有「目前有開放」的怪物；含掉落機率與數量（依機率高到低排）。 */
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
              EXISTS(SELECT 1 FROM spawnlist_boss sb WHERE sb.npc_templateid = d.mobId AND sb.count > 0) AS isBoss
       FROM droplist d
       INNER JOIN npc n ON n.npcid = d.mobId
       WHERE d.itemId = ?
         AND d.mobId IN ${this.activeMobsCte}
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
        chancePercent: Number(r.chance) / 10000, // 1,000,000 = 100% → 除 10000 取百分比
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
              EXISTS(SELECT 1 FROM spawnlist_boss sb WHERE sb.npc_templateid = n.npcid AND sb.count > 0) AS isBoss
       FROM npc n
       WHERE n.npcid = ? AND n.npcid IN ${this.activeMobsCte}
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
       WHERE d.mobId = ?
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
