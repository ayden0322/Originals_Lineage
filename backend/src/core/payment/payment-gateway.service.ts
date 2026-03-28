import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { CreateGatewayDto } from './dto/create-gateway.dto';
import { UpdateGatewayDto } from './dto/update-gateway.dto';

@Injectable()
export class PaymentGatewayService {
  constructor(
    @InjectRepository(PaymentGateway)
    private readonly gatewayRepo: Repository<PaymentGateway>,
  ) {}

  async create(dto: CreateGatewayDto): Promise<PaymentGateway> {
    // 檢查同模組同供應商是否已存在
    const existing = await this.gatewayRepo.findOne({
      where: {
        moduleCode: dto.moduleCode,
        providerCode: dto.providerCode,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Gateway for module "${dto.moduleCode}" with provider "${dto.providerCode}" already exists`,
      );
    }

    const gateway = this.gatewayRepo.create(dto);
    return this.gatewayRepo.save(gateway);
  }

  async findByModule(moduleCode: string): Promise<PaymentGateway[]> {
    return this.gatewayRepo.find({
      where: { moduleCode },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<PaymentGateway> {
    const gateway = await this.gatewayRepo.findOne({ where: { id } });
    if (!gateway) {
      throw new NotFoundException('Payment gateway not found');
    }
    return gateway;
  }

  async update(id: string, dto: UpdateGatewayDto): Promise<PaymentGateway> {
    const gateway = await this.findById(id);
    Object.assign(gateway, dto);
    return this.gatewayRepo.save(gateway);
  }

  async remove(id: string): Promise<void> {
    const gateway = await this.findById(id);
    await this.gatewayRepo.remove(gateway);
  }

  async findByProviderCode(
    moduleCode: string,
    providerCode: string,
  ): Promise<PaymentGateway | null> {
    return this.gatewayRepo.findOne({
      where: { moduleCode, providerCode },
    });
  }
}
