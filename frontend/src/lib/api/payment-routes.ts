import apiClient from './client';
import type {
  ApiResponse,
  PaymentRouteItem,
  UpdatePaymentRoutesDto,
} from '../types';

/**
 * 取得指定模組的付款方式 → 金流商 路由設定
 */
export async function getPaymentRoutes(
  moduleCode = 'originals-lineage',
): Promise<PaymentRouteItem[]> {
  const { data } = await apiClient.get<ApiResponse<PaymentRouteItem[]>>(
    '/modules/originals/payment-routes',
    { params: { moduleCode } },
  );
  return data.data;
}

/**
 * 批次更新付款方式 → 金流商 路由設定
 */
export async function updatePaymentRoutes(
  dto: UpdatePaymentRoutesDto,
  moduleCode = 'originals-lineage',
): Promise<PaymentRouteItem[]> {
  const { data } = await apiClient.put<ApiResponse<PaymentRouteItem[]>>(
    '/modules/originals/payment-routes',
    dto,
    { params: { moduleCode } },
  );
  return data.data;
}
