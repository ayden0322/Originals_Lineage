import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  BadRequestException,
  Delete,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../permission/decorators/require-permission.decorator';
import { StorageService } from './storage.service';
import { SystemLogService } from '../system-log/system-log.service';
import { Request } from 'express';

@ApiTags('Storage')
@Controller('modules/originals/storage')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly logService: SystemLogService,
  ) {}

  @Get('list')
  @RequirePermission('module.originals.media.view')
  async list(@Query('folder') folder?: string) {
    return this.storageService.listObjects(folder);
  }

  @Post('upload')
  @RequirePermission('module.originals.content.create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB（支援影片上傳）
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string' },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
    @Req() req?: Request,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const result = await this.storageService.upload(file, folder || 'general');

    // 明確記錄檔案上傳操作
    const user = (req as unknown as Record<string, unknown>)?.user as Record<string, unknown>;
    this.logService.log({
      actorId: (user?.sub as string) || undefined,
      action: 'UPLOAD_FILE',
      resourceType: 'storage',
      resourceId: result.objectName,
      details: {
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        folder: folder || 'general',
        objectName: result.objectName,
        actorEmail: (user?.email as string) || null,
      },
      ipAddress: this.extractIp(req),
      userAgent: req?.headers?.['user-agent'],
    });

    return result;
  }

  @Delete('delete')
  @RequirePermission('module.originals.media.manage')
  async remove(
    @Body('objectName') objectName: string,
    @Req() req?: Request,
  ) {
    if (!objectName) {
      throw new BadRequestException('objectName is required');
    }
    await this.storageService.delete(objectName);

    // 明確記錄檔案刪除操作
    const user = (req as unknown as Record<string, unknown>)?.user as Record<string, unknown>;
    this.logService.log({
      actorId: (user?.sub as string) || undefined,
      action: 'DELETE_FILE',
      resourceType: 'storage',
      resourceId: objectName,
      details: {
        objectName,
        actorEmail: (user?.email as string) || null,
      },
      ipAddress: this.extractIp(req),
      userAgent: req?.headers?.['user-agent'],
    });

    return { message: 'File deleted' };
  }

  private extractIp(req?: Request): string {
    if (!req) return 'unknown';
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }
    return req.ip || 'unknown';
  }
}
