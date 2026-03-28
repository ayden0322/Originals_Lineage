import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../core/permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { MemberService } from './member.service';
import { CreateWebsiteUserDto } from './dto/create-website-user.dto';
import { BindGameAccountDto } from './dto/bind-game-account.dto';
import { UpdateBindingStatusDto } from './dto/update-binding-status.dto';
import { CheckGameAccountDto } from './dto/check-game-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeSecondPasswordDto } from './dto/change-second-password.dto';
import { AdminResetSecondPasswordDto } from './dto/admin-reset-second-password.dto';

// ═══════════════════════════════════════════════════════════════════
// Admin Controller — requires JWT + Permission guards
// ═══════════════════════════════════════════════════════════════════

@ApiTags('Originals Lineage - Members (Admin)')
@ApiBearerAuth()
@Controller('modules/originals/members')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get()
  @RequirePermission('module.originals.members.view')
  findAll(@Query() query: PaginationDto) {
    return this.memberService.findAllMembers(query.page, query.limit);
  }

  @Get(':id')
  @RequirePermission('module.originals.members.view')
  findOne(@Param('id') id: string) {
    return this.memberService.findBindingById(id);
  }

  @Patch(':id/status')
  @RequirePermission('module.originals.members.edit')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBindingStatusDto,
  ) {
    return this.memberService.updateBindingStatus(id, dto.bindingStatus);
  }

  @Post(':id/reset-second-password')
  @RequirePermission('module.originals.members.edit')
  resetSecondPassword(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: AdminResetSecondPasswordDto,
  ) {
    return this.memberService.adminResetSecondPassword(
      id,
      dto.newSecondPassword,
      adminId,
    );
  }

  @Get(':id/second-password-logs')
  @RequirePermission('module.originals.members.view')
  getSecondPasswordLogs(@Param('id') id: string) {
    return this.memberService.getSecondPasswordLogs(id);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Public Player Controller — no permission guard (player-facing)
// ═══════════════════════════════════════════════════════════════════

@ApiTags('Originals Lineage - Player Auth')
@Controller('public/originals')
export class MemberPublicController {
  constructor(private readonly memberService: MemberService) {}

  // ─── Auth (no guard) ──────────────────────────────────────────

  @Post('auth/register')
  register(@Body() dto: CreateWebsiteUserDto) {
    return this.memberService.register(dto);
  }

  @Post('auth/login')
  login(@Body() body: { gameAccountName: string; password: string }) {
    return this.memberService.loginPlayer(body.gameAccountName, body.password);
  }

  @Post('auth/check-game-account')
  checkGameAccount(@Body() dto: CheckGameAccountDto) {
    return this.memberService.checkGameAccount(dto.gameAccountName);
  }

  // ─── Player JWT required ────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('auth/profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.memberService.getPlayerProfile(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('auth/change-password')
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.memberService.changePassword(userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('auth/change-second-password')
  changeSecondPassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangeSecondPasswordDto,
  ) {
    return this.memberService.changeSecondPassword(userId, dto);
  }

  // ─── Binding (player JWT required) ────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('members/bind')
  bindGameAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: BindGameAccountDto,
  ) {
    return this.memberService.bindGameAccount(userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('members/my-binding')
  getMyBinding(@CurrentUser('id') userId: string) {
    return this.memberService.getMyBinding(userId);
  }
}
