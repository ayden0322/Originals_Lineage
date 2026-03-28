import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentRouterService } from './payment-router.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { EcpayPaymentProvider } from './providers/ecpay-payment.provider';
import { SmilepayPaymentProvider } from './providers/smilepay-payment.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentTransaction, PaymentGateway]),
  ],
  controllers: [PaymentController, PaymentGatewayController],
  providers: [
    PaymentService,
    PaymentGatewayService,
    PaymentRouterService,
    MockPaymentProvider,
    EcpayPaymentProvider,
    SmilepayPaymentProvider,
  ],
  exports: [PaymentService, PaymentGatewayService, PaymentRouterService],
})
export class PaymentModule {}
