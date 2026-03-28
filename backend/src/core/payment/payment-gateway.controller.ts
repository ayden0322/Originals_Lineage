import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentRouterService } from './payment-router.service';
import { CreateGatewayDto } from './dto/create-gateway.dto';
import { UpdateGatewayDto } from './dto/update-gateway.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../permission/decorators/require-permission.decorator';

@ApiTags('Payment Gateways')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals/payment-gateways')
export class PaymentGatewayController {
  constructor(
    private readonly gatewayService: PaymentGatewayService,
    private readonly routerService: PaymentRouterService,
  ) {}

  @Get()
  @RequirePermission('module.originals.settings.manage')
  findAll(@Query('moduleCode') moduleCode = 'originals-lineage') {
    return this.gatewayService.findByModule(moduleCode);
  }

  @Get('providers')
  @RequirePermission('module.originals.settings.manage')
  getAvailableProviders() {
    return this.routerService.getAvailableProviderCodes();
  }

  @Post()
  @RequirePermission('module.originals.settings.manage')
  create(@Body() dto: CreateGatewayDto) {
    return this.gatewayService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('module.originals.settings.manage')
  update(@Param('id') id: string, @Body() dto: UpdateGatewayDto) {
    return this.gatewayService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('module.originals.settings.manage')
  remove(@Param('id') id: string) {
    return this.gatewayService.remove(id);
  }
}
