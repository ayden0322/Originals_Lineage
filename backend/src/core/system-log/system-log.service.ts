import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SystemLog } from './entities/system-log.entity';

@Injectable()
export class SystemLogService {
  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepo: Repository<SystemLog>,
  ) {}

  async log(params: {
    actorId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const entry = this.logRepo.create(params);
    return this.logRepo.save(entry);
  }

  async findAll(page = 1, limit = 50) {
    const [items, total] = await this.logRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { items, total, page, limit };
  }

  async findByResource(
    resourceType: string,
    resourceId: string,
    actions?: string[],
  ) {
    const where: Record<string, unknown> = { resourceType, resourceId };
    if (actions && actions.length > 0) {
      where.action = In(actions);
    }
    return this.logRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }
}
