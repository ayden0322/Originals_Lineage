import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../permission/decorators/require-permission.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 金流回調端點（各金流商 webhook POST 通知）
   * ECPay ReturnURL 指向：POST /api/payment/notify/ecpay
   * Mock 指向：POST /api/payment/notify/mock
   *
   * ECPay 要求回應純文字 "1|OK"
   */
  @Post('notify/:providerCode')
  async handleCallback(
    @Param('providerCode') providerCode: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Res() res: Response,
  ) {
    const result = await this.paymentService.handleCallback(
      providerCode,
      body,
      headers,
    );

    // ECPay 要求回應純文字 "1|OK"
    if (providerCode === 'ecpay') {
      res.type('text/plain').send('1|OK');
      return;
    }

    // SmilePay 回應確認
    if (providerCode === 'smilepay') {
      res.type('text/plain').send('OK');
      return;
    }

    // tw92 回應純文字 OK（避免平台重送）
    if (providerCode === 'tw92') {
      res.type('text/plain').send('OK');
      return;
    }

    // 其他金流商回傳 JSON
    res.json(result);
  }

  /**
   * ECPay 付款完成後瀏覽器 POST 導回中繼端點
   * ECPay OrderResultURL 指向此處（POST），
   * 接收後 302 GET 重導向到前端結果頁，避免 Next.js SSR 無法處理 POST
   */
  @Post('ecpay/return')
  async handleEcpayReturn(
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const frontendPort = '3000';
    const frontendHost =
      process.env.FRONTEND_PUBLIC_URL || `http://localhost:${frontendPort}`;

    const orderId = (body.CustomField1 as string) || '';
    const rtnCode = (body.RtnCode as string) || '';
    const rtnMsg = encodeURIComponent((body.RtnMsg as string) || '');

    const redirectUrl =
      `${frontendHost}/public/payment/result?orderId=${orderId}&RtnCode=${rtnCode}&RtnMsg=${rtnMsg}`;

    res.redirect(302, redirectUrl);
  }

  // 保留舊的 callback/:moduleCode 路由以維持相容
  @Post('callback/:moduleCode')
  async handleLegacyCallback(
    @Param('moduleCode') moduleCode: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Res() res: Response,
  ) {
    // 舊路由用 mock 處理
    const result = await this.paymentService.handleCallback(
      'mock',
      body,
      headers,
    );
    res.json(result);
  }

  @Get('transactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('platform.transactions.view')
  findAll(@Query() query: PaginationDto) {
    return this.paymentService.findAll(
      query.page,
      query.limit,
      (query as any).moduleCode,
    );
  }
}
