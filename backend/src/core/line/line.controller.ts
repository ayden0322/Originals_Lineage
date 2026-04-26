import {
  Controller,
  Post,
  Param,
  Headers,
  Req,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { LineService } from './line.service';

interface LineWebhookEvent {
  type: string;
  source?: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: { type: string; text?: string };
  timestamp?: number;
}

interface LineWebhookBody {
  destination?: string;
  events?: LineWebhookEvent[];
}

@ApiTags('LINE Webhook')
@Controller('line/webhook')
export class LineWebhookController {
  private readonly logger = new Logger(LineWebhookController.name);

  constructor(private readonly lineService: LineService) {}

  /**
   * LINE Messaging API Webhook 端點。
   * 路徑帶 moduleCode：未來不同模組可掛各自的 LINE Channel
   *
   * 驗證流程：
   * 1. 找到該 module 的 channelSecret
   * 2. 用 rawBody 計算 HMAC-SHA256，比對 X-Line-Signature
   * 3. 通過後解析 events，把 source 記錄到記憶體（給後台找 groupId）
   *
   * 永遠回 200（除了簽章失敗）：避免 LINE 重試風暴
   */
  @Post(':moduleCode')
  @HttpCode(200)
  async handle(
    @Param('moduleCode') moduleCode: string,
    @Headers('x-line-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ ok: boolean }> {
    const cfg = await this.lineService.getConfig(moduleCode);
    if (!cfg.channelSecret) {
      this.logger.warn(`[${moduleCode}] webhook 收到事件但 channelSecret 未設定`);
      throw new BadRequestException('LINE channel not configured');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    if (!this.lineService.verifySignature(cfg.channelSecret, rawBody, signature)) {
      this.logger.warn(`[${moduleCode}] webhook 簽章驗證失敗`);
      throw new BadRequestException('Invalid signature');
    }

    let body: LineWebhookBody = {};
    try {
      body = JSON.parse(rawBody.toString('utf8')) as LineWebhookBody;
    } catch {
      throw new BadRequestException('Invalid JSON');
    }

    const events = body.events || [];
    for (const event of events) {
      const src = event.source;
      if (!src) continue;
      this.lineService.rememberSource(moduleCode, {
        type: src.type,
        groupId: src.groupId,
        roomId: src.roomId,
        userId: src.userId,
        eventType: event.type,
        receivedAt: new Date().toISOString(),
      });
      this.logger.log(
        `[${moduleCode}] event=${event.type} source=${src.type} ` +
          `groupId=${src.groupId ?? '-'} userId=${src.userId ?? '-'}`,
      );
    }

    return { ok: true };
  }
}
