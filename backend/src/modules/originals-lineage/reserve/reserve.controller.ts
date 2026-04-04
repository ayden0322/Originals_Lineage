import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ReserveService } from './reserve.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/verify-email.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';

// ──────────────────────────────────────────────
// Public endpoints (no auth)
// ──────────────────────────────────────────────

@ApiTags('Public - Reservations')
@Controller('public/originals/reserve')
export class ReservePublicController {
  constructor(private readonly reserveService: ReserveService) {}

  @Post()
  async create(@Body() dto: CreateReservationDto, @Req() req: Request) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    return this.reserveService.create(dto, ipAddress);
  }

  @Get('count')
  async getCount() {
    const count = await this.reserveService.getPublicCount();
    return { count };
  }

  @Get('milestones')
  async getPublicMilestones() {
    return this.reserveService.getPublicMilestones();
  }

  @Post('verify')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.reserveService.verifyEmail(dto.email, dto.code);
  }

  @Post('resend')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.reserveService.resendVerification(dto.email);
  }
}

// ──────────────────────────────────────────────
// Admin endpoints (JWT + Permission guards)
// ──────────────────────────────────────────────

@ApiTags('Admin - Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('modules/originals/reservations')
export class ReserveAdminController {
  constructor(private readonly reserveService: ReserveService) {}

  // ─── 預約管理 ──────────────────────────────────────────────────

  @Get()
  @RequirePermission('module.originals.reserve.view')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.reserveService.findAll(+page, +limit, status);
  }

  @Get('stats')
  @RequirePermission('module.originals.reserve.view')
  getStats() {
    return this.reserveService.getStats();
  }

  @Patch(':id/status')
  @RequirePermission('module.originals.reserve.manage')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    return this.reserveService.updateStatus(id, dto.status);
  }

  @Post('export')
  @RequirePermission('module.originals.reserve.manage')
  async exportCsv(@Res() res: Response) {
    const csv = await this.reserveService.exportCsv();

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reservations.csv"',
    });
    res.send(csv);
  }

  // ─── 里程碑管理 ────────────────────────────────────────────────

  @Get('milestones')
  @RequirePermission('module.originals.settings.manage')
  findAllMilestones() {
    return this.reserveService.findAllMilestones();
  }

  @Post('milestones')
  @RequirePermission('module.originals.settings.manage')
  createMilestone(@Body() dto: CreateMilestoneDto) {
    return this.reserveService.createMilestone(dto);
  }

  @Patch('milestones/:id')
  @RequirePermission('module.originals.settings.manage')
  updateMilestone(
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.reserveService.updateMilestone(id, dto);
  }

  @Delete('milestones/:id')
  @RequirePermission('module.originals.settings.manage')
  deleteMilestone(@Param('id') id: string) {
    return this.reserveService.deleteMilestone(id);
  }
}
