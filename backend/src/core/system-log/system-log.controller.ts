import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { SystemLogService } from './system-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../permission/decorators/require-permission.decorator';

@ApiTags('System Logs')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SystemLogController {
  constructor(private readonly logService: SystemLogService) {}

  /** 主後台 — 平台層級日誌查詢 */
  @Get('logs')
  @RequirePermission('platform.logs.view')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'ipAddress', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('actorId') actorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.logService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      ipAddress,
      action,
      resourceType,
      actorId,
      startDate,
      endDate,
    });
  }

  /** 模組後台 — 始祖天堂操作日誌查詢 */
  @Get('modules/originals/logs')
  @RequirePermission('module.originals.logs.view')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'ipAddress', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findModuleLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.logService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      ipAddress,
      action,
      resourceType,
      startDate,
      endDate,
    });
  }
}
