import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { PaymentChannelRoute } from './entities/payment-channel-route.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentRouterService } from './payment-router.service';
import { PaymentRouteController } from './payment-route.controller';
import { PaymentRouteService } from './payment-route.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { EcpayPaymentProvider } from './providers/ecpay-payment.provider';
import { SmilepayPaymentProvider } from './providers/smilepay-payment.provider';
import { AntpayPaymentProvider } from './providers/antpay-payment.provider';
import { Tx2PaymentProvider } from './providers/tx2-payment.provider';
import { Tw92PaymentProvider } from './providers/tw92-payment.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction,
      PaymentGateway,
      PaymentChannelRoute,
    ]),
  ],
  controllers: [
    PaymentController,
    PaymentGatewayController,
    PaymentRouteController,
  ],
  providers: [
    PaymentService,
    PaymentGatewayService,
    PaymentRouterService,
    PaymentRouteService,
    MockPaymentProvider,
    EcpayPaymentProvider,
    SmilepayPaymentProvider,
    AntpayPaymentProvider,
    Tx2PaymentProvider,
    Tw92PaymentProvider,
  ],
  exports: [
    PaymentService,
    PaymentGatewayService,
    PaymentRouterService,
    PaymentRouteService,
  ],
})
export class PaymentModule {}
