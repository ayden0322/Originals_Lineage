import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ModuleAdminAuthService } from './module-admin-auth.service';
import { LoginDto } from '../../../core/auth/dto/login.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from '../../../core/auth/guards/jwt-refresh.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Originals Lineage - Admin Auth')
@Controller('modules/originals/admin-auth')
export class ModuleAdminAuthController {
  constructor(private readonly authService: ModuleAdminAuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  refresh(@CurrentUser() user: { id: string; refreshToken: string }) {
    return this.authService.refresh(user.id, user.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: { id: string }) {
    return this.authService.logout(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }
}
