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
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../permission/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @RequirePermission('platform.accounts.create')
  create(@Body() dto: CreateAccountDto) {
    return this.accountService.create(dto);
  }

  @Get()
  @RequirePermission('platform.accounts.view')
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.accountService.findAll(+page, +limit);
  }

  @Get(':id')
  @RequirePermission('platform.accounts.view')
  findOne(@Param('id') id: string) {
    return this.accountService.findById(id);
  }

  @Patch(':id')
  @RequirePermission('platform.accounts.edit')
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('platform.accounts.delete')
  deactivate(@Param('id') id: string) {
    return this.accountService.deactivate(id);
  }
}
