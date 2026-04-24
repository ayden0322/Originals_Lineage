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

    response.status(status).json({
      success: false,
      data: null,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
