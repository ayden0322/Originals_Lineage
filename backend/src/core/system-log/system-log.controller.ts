import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SystemLogService } from './system-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../permission/decorators/require-permission.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('System Logs')
@ApiBearerAuth()
@Controller('logs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SystemLogController {
  constructor(private readonly logService: SystemLogService) {}

  @Get()
  @RequirePermission('platform.logs.view')
  findAll(@Query() query: PaginationDto) {
    return this.logService.findAll(query.page, query.limit);
  }
}
