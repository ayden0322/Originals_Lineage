import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { REDIS_CLIENT } from '../../../core/database/redis.module';

const REDIS_RESERVE_COUNT_KEY = 'reserve:count';
const REDIS_RESERVE_COUNT_TTL = 60;

@Injectable()
export class ReserveService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * Create a new reservation (public registration)
   */
  async create(
    dto: CreateReservationDto,
    ipAddress: string | null,
  ): Promise<Reservation> {
    const existing = await this.reservationRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('This email has already been registered');
    }

    const reservation = this.reservationRepo.create({
      ...dto,
      ipAddress,
    });

    const saved = await this.reservationRepo.save(reservation);

    // Increment Redis counter
    const exists = await this.redis.exists(REDIS_RESERVE_COUNT_KEY);
    if (exists) {
      await this.redis.incr(REDIS_RESERVE_COUNT_KEY);
    }

    return saved;
  }

  /**
   * Get public reservation count (with Redis caching)
   */
  async getPublicCount(): Promise<number> {
    const cached = await this.redis.get(REDIS_RESERVE_COUNT_KEY);

    if (cached !== null) {
      return parseInt(cached, 10);
    }

    // Cache miss: count from DB and store in Redis
    const count = await this.reservationRepo.count();
    await this.redis.set(REDIS_RESERVE_COUNT_KEY, count, 'EX', REDIS_RESERVE_COUNT_TTL);

    return count;
  }

  /**
   * Admin: list reservations with optional status filter and pagination
   */
  async findAll(
    page: number,
    limit: number,
    status?: string,
  ): Promise<{ data: Reservation[]; total: number; page: number; limit: number }> {
    const where: Record<string, any> = {};

    if (status) {
      where.status = status;
    }

    const [data, total] = await this.reservationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  /**
   * Admin: get reservation statistics
   */
  async getStats(): Promise<{
    total: number;
    registered: number;
    confirmed: number;
    converted: number;
  }> {
    const total = await this.reservationRepo.count();
    const registered = await this.reservationRepo.count({
      where: { status: 'registered' },
    });
    const confirmed = await this.reservationRepo.count({
      where: { status: 'confirmed' },
    });
    const converted = await this.reservationRepo.count({
      where: { status: 'converted' },
    });

    return { total, registered, confirmed, converted };
  }

  /**
   * Admin: update reservation status
   */
  async updateStatus(
    id: string,
    status: 'registered' | 'confirmed' | 'converted',
  ): Promise<Reservation> {
    const reservation = await this.reservationRepo.findOne({ where: { id } });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    reservation.status = status;
    return this.reservationRepo.save(reservation);
  }

  /**
   * Admin: export all reservations as CSV string
   */
  async exportCsv(): Promise<string> {
    const reservations = await this.reservationRepo.find({
      order: { createdAt: 'DESC' },
    });

    const header = 'email,displayName,phone,lineId,referralCode,status,createdAt';
    const rows = reservations.map((r) => {
      return [
        this.escapeCsvField(r.email),
        this.escapeCsvField(r.displayName),
        this.escapeCsvField(r.phone ?? ''),
        this.escapeCsvField(r.lineId ?? ''),
        this.escapeCsvField(r.referralCode ?? ''),
        r.status,
        r.createdAt.toISOString(),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
