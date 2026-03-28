import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  PaymentVerification,
} from '../interfaces/payment-provider.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly providerCode = 'mock';

  async createOrder(
    params: CreatePaymentParams,
    credentials: Record<string, unknown>,
  ): Promise<PaymentResult> {
    const transactionId = `mock_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return {
      transactionId,
      paymentUrl: `https://mock-payment.local/pay/${transactionId}?amount=${params.amount}`,
      status: 'pending',
    };
  }

  async verifyCallback(
    body: Record<string, unknown>,
    headers: Record<string, string>,
    credentials: Record<string, unknown>,
  ): Promise<PaymentVerification> {
    return {
      orderId: (body.orderId as string) ?? '',
      transactionId: (body.transactionId as string) ?? '',
      amount: (body.amount as number) ?? 0,
      status: 'paid',
      rawData: body,
    };
  }

  async queryOrder(
    transactionId: string,
    credentials: Record<string, unknown>,
  ): Promise<{ status: string; paidAt?: Date }> {
    return {
      status: 'paid',
      paidAt: new Date(),
    };
  }
}
