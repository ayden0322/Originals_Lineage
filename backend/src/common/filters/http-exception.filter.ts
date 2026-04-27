import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as { message: string }).message || message;
    } else {
      const err = exception as Error;
      this.logger.error(
        `Unhandled error on ${request?.method} ${request?.url}: ${err?.message || exception}`,
        err?.stack,
      );
    }

    // 429 throttler：替換成易懂訊息 + 帶上 retryAfter，讓前端可顯示倒數
    let retryAfter: number | undefined;
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      const retryHeader = response.getHeader('Retry-After');
      retryAfter = retryHeader ? Number(retryHeader) : 60;
      const url = request?.url || '';
      if (url.includes('/auth/login') || url.includes('/auth/module-login')) {
        message = `登入嘗試次數過多，請於 ${retryAfter} 秒後再試。若忘記密碼請聯絡管理員。`;
      } else if (url.includes('/auth/register')) {
        message = `註冊嘗試過於頻繁，請於 ${retryAfter} 秒後再試。`;
      } else {
        message = `操作過於頻繁，請於 ${retryAfter} 秒後再試。`;
      }
    }

    response.status(status).json({
      success: false,
      data: null,
      message,
      statusCode: status,
      ...(retryAfter !== undefined ? { retryAfter } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
