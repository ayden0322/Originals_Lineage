import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ModuleConfigService } from '../module-config/module-config.service';

/**
 * LINE Bot 設定（存於 module_configs.config_json.lineBot）
 */
export interface LineBotConfig {
  channelId?: string;
  channelSecret?: string;
  channelAccessToken?: string;
  rechargeNotifyEnabled?: boolean;
  notifyGroups?: NotifyGroup[];
}

export interface NotifyGroup {
  groupId: string;
  name: string;
  events: NotifyEvent[]; // 目前只用 'recharge'
}

export type NotifyEvent = 'recharge';

/**
 * webhook 收到的 source 事件，用來幫管理員找 groupId
 * 只暫存在記憶體，不入庫；重啟即清空。
 */
export interface RecentSource {
  type: 'group' | 'room' | 'user';
  groupId?: string;
  roomId?: string;
  userId?: string;
  eventType: string; // 'join' | 'message' | ...
  receivedAt: string;
}

const RECENT_SOURCE_LIMIT = 20;
const LINE_API_BASE = 'https://api.line.me/v2/bot';

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);

  // moduleCode → 最近事件清單（記憶體 ring buffer）
  private readonly recentSources = new Map<string, RecentSource[]>();

  constructor(private readonly moduleConfigService: ModuleConfigService) {}

  // ─── 設定讀取 ────────────────────────────────────────────────

  async getConfig(moduleCode: string): Promise<LineBotConfig> {
    const config = await this.moduleConfigService.findByCode(moduleCode);
    if (!config) return {};
    const lineBot = (config.configJson?.['lineBot'] as LineBotConfig) || {};
    return lineBot;
  }

  // ─── 簽章驗證 ────────────────────────────────────────────────

  /**
   * 驗證 LINE Webhook 簽章
   * X-Line-Signature = base64( HMAC-SHA256( channelSecret, rawBody ) )
   */
  verifySignature(
    channelSecret: string,
    rawBody: Buffer | string,
    signature: string,
  ): boolean {
    if (!channelSecret || !signature) return false;
    const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const expected = crypto
      .createHmac('sha256', channelSecret)
      .update(buf)
      .digest('base64');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  }

  // ─── 訊息推送 ────────────────────────────────────────────────

  /**
   * 推訊息到指定 target（可以是 userId / groupId / roomId）。
   * messages 必須符合 LINE Messaging API 格式：
   *   { type: 'text', text: '...' } 或 { type: 'flex', altText, contents }
   */
  async push(
    moduleCode: string,
    to: string,
    messages: Array<Record<string, unknown>>,
  ): Promise<void> {
    const cfg = await this.getConfig(moduleCode);
    if (!cfg.channelAccessToken) {
      throw new BadRequestException('LINE Channel Access Token 未設定');
    }
    if (!to) {
      throw new BadRequestException('推送目標 (to) 未提供');
    }
    if (!messages?.length) {
      throw new BadRequestException('訊息內容為空');
    }

    const res = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.channelAccessToken}`,
      },
      body: JSON.stringify({ to, messages }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `LINE push failed: status=${res.status}, to=${to}, body=${text}`,
      );
      throw new Error(`LINE push failed: ${res.status} ${text}`);
    }
  }

  /**
   * 對所有有訂閱 event 的 notifyGroups 推送
   * 任一群組推送失敗不影響其他群組
   */
  async broadcastToNotifyGroups(
    moduleCode: string,
    event: NotifyEvent,
    messages: Array<Record<string, unknown>>,
  ): Promise<{ ok: number; failed: number }> {
    const cfg = await this.getConfig(moduleCode);
    if (!cfg.rechargeNotifyEnabled) {
      this.logger.log(`[${moduleCode}] LINE 通知未啟用，跳過`);
      return { ok: 0, failed: 0 };
    }
    if (!cfg.channelAccessToken) {
      this.logger.warn(`[${moduleCode}] 未設 channelAccessToken，跳過 LINE 通知`);
      return { ok: 0, failed: 0 };
    }
    const targets = (cfg.notifyGroups || []).filter((g) =>
      g.events?.includes(event),
    );
    if (!targets.length) {
      this.logger.log(`[${moduleCode}] 無訂閱 ${event} 的群組，跳過`);
      return { ok: 0, failed: 0 };
    }

    let ok = 0;
    let failed = 0;
    await Promise.all(
      targets.map(async (g) => {
        try {
          await this.push(moduleCode, g.groupId, messages);
          ok++;
        } catch (err) {
          failed++;
          this.logger.error(
            `推送到 ${g.name} (${g.groupId}) 失敗：${(err as Error).message}`,
          );
        }
      }),
    );
    return { ok, failed };
  }

  // ─── webhook 來源暫存（找 groupId 用） ─────────────────────────

  rememberSource(moduleCode: string, source: RecentSource) {
    const list = this.recentSources.get(moduleCode) || [];
    // 同一 groupId/userId 已存在則略過
    const key = source.groupId || source.roomId || source.userId;
    if (key && list.some((s) => (s.groupId || s.roomId || s.userId) === key)) {
      return;
    }
    list.unshift(source);
    if (list.length > RECENT_SOURCE_LIMIT) list.length = RECENT_SOURCE_LIMIT;
    this.recentSources.set(moduleCode, list);
  }

  getRecentSources(moduleCode: string): RecentSource[] {
    return this.recentSources.get(moduleCode) || [];
  }
}
