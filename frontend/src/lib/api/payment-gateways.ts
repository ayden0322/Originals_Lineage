import apiClient from './client';
import type {
  ApiResponse,
  PaymentGateway,
  CreateGatewayDto,
  UpdateGatewayDto,
} from '../types';

export async function getPaymentGateways(
  moduleCode = 'originals-lineage',
): Promise<PaymentGateway[]> {
  const { data } = await apiClient.get<ApiResponse<PaymentGateway[]>>(
    '/modules/originals/payment-gateways',
    { params: { moduleCode } },
  );
  return data.data;
}

export async function getAvailableProviders(): Promise<string[]> {
  const { data } = await apiClient.get<ApiResponse<string[]>>(
    '/modules/originals/payment-gateways/providers',
  );
  return data.data;
}

export async function createPaymentGateway(
  dto: CreateGatewayDto,
): Promise<PaymentGateway> {
  const { data } = await apiClient.post<ApiResponse<PaymentGateway>>(
    '/modules/originals/payment-gateways',
    dto,
  );
  return data.data;
}

export async function updatePaymentGateway(
  id: string,
  dto: UpdateGatewayDto,
): Promise<PaymentGateway> {
  const { data } = await apiClient.patch<ApiResponse<PaymentGateway>>(
    `/modules/originals/payment-gateways/${id}`,
    dto,
  );
  return data.data;
}

export async function deletePaymentGateway(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/payment-gateways/${id}`);
}
