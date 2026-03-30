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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../permission/decorators/require-permission.decorator';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@Controller('modules/originals/storage')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('list')
  @RequirePermission('module.originals.media.view')
  async list(@Query('folder') folder?: string) {
    const items = await this.storageService.listObjects(folder);
    return { data: items };
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
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.storageService.upload(file, folder || 'general');
  }

  @Delete('delete')
  @RequirePermission('module.originals.media.manage')
  async remove(@Body('objectName') objectName: string) {
    if (!objectName) {
      throw new BadRequestException('objectName is required');
    }
    await this.storageService.delete(objectName);
    return { message: 'File deleted' };
  }
}
