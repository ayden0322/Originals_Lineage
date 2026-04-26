import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DropQueryService } from './drop-query.service';

@ApiTags('Originals Lineage - Drop Query (Public)')
@Controller('public/originals')
export class DropQueryPublicController {
  constructor(private readonly service: DropQueryService) {}

  @Get('items/search')
  searchItems(
    @Query('q') q = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    return this.service.searchItems(q, p, l);
  }

  @Get('items/:itemId/dropped-by')
  getMonstersDroppingItem(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.service.getMonstersDroppingItem(itemId);
  }

  @Get('monsters/search')
  searchMonsters(
    @Query('q') q = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    return this.service.searchMonsters(q, p, l);
  }

  @Get('monsters/:npcid/drops')
  getDropsByMonster(@Param('npcid', ParseIntPipe) npcid: number) {
    return this.service.getDropsByMonster(npcid);
  }
}
