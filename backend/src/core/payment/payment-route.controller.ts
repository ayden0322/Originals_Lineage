import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentRouteService } from './payment-route.service';
import { UpdatePaymentRoutesDto } from './dto/update-payment-routes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../permission/decorators/require-permission.decorator';

/**
 * 伺服器金流路由設定 API
 *
 * 一對一映射：每個 module 內，每個付款方式只對應一個金流商。
 * 玩家完全不知道背後是哪家金流商，管理者隨時可切換。
 */
@ApiTags('Payment Routes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals/payment-routes')
export class PaymentRouteController {
  constructor(private readonly routeService: PaymentRouteService) {}

  @Get()
  @RequirePermission('module.originals.settings.manage')
  findAll(@Query('moduleCode') moduleCode = 'originals-lineage') {
    return this.routeService.findByModule(moduleCode);
  }

  @Put()
  @RequirePermission('module.originals.settings.manage')
  update(
    @Query('moduleCode') moduleCode = 'originals-lineage',
    @Body() dto: UpdatePaymentRoutesDto,
  ) {
    return this.routeService.updateRoutes(moduleCode, dto);
  }
}
