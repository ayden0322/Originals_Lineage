import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, Like } from 'typeorm';
import { SystemLog } from './entities/system-log.entity';

export interface LogQueryParams {
  page?: number;
  limit?: number;
  ipAddress?: string;
  action?: string;
  resourceType?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}

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

  async findAll(query: LogQueryParams = {}) {
    const { page = 1, limit = 50, ipAddress, action, resourceType, actorId, startDate, endDate } = query;

    const qb = this.logRepo.createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (ipAddress) {
      qb.andWhere('log.ipAddress LIKE :ip', { ip: `%${ipAddress}%` });
    }
    if (action) {
      qb.andWhere('log.action LIKE :action', { action: `%${action}%` });
    }
    if (resourceType) {
      qb.andWhere('log.resourceType = :resourceType', { resourceType });
    }
    if (actorId) {
      qb.andWhere('log.actorId = :actorId', { actorId });
    }
    if (startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: new Date(endDate) });
    }

    const [items, total] = await qb.getManyAndCount();
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
