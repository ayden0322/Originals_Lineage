import apiClient from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  Product,
  Order,
  CreateProductDto,
  PaymentResult,
  GameItem,
  ProductTemplate,
  CreateProductTemplateDto,
  RefundOrderResult,
} from '../types';

// ─── Admin - Products ────────────────────────────────────────────────
export async function getProducts(
  page = 1,
  limit = 10,
  category?: string,
): Promise<PaginatedResponse<Product>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Product>>>(
    '/modules/originals/products',
    { params: { page, limit, category } },
  );
  return data.data;
}

export async function createProduct(dto: CreateProductDto): Promise<Product> {
  const { data } = await apiClient.post<ApiResponse<Product>>(
    '/modules/originals/products',
    dto,
  );
  return data.data;
}

export async function updateProduct(
  id: string,
  dto: Partial<CreateProductDto>,
): Promise<Product> {
  const { data } = await apiClient.patch<ApiResponse<Product>>(
    `/modules/originals/products/${id}`,
    dto,
  );
  return data.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/products/${id}`);
}

export async function moveProduct(id: string, direction: 'up' | 'down'): Promise<void> {
  await apiClient.post(`/modules/originals/products/${id}/move`, { direction });
}

// ─── Admin - Game Items（從遊戲庫挑物品）────────────────────────────
export async function getGameItems(
  search?: string,
  page = 1,
  limit = 30,
): Promise<{ items: GameItem[]; total: number }> {
  const { data } = await apiClient.get<ApiResponse<{ items: GameItem[]; total: number }>>(
    '/modules/originals/shop/game-items',
    { params: { search, page, limit } },
  );
  return data.data;
}

// ─── Admin - Product Templates（共用範本）──────────────────────────
export async function getProductTemplates(category?: string): Promise<ProductTemplate[]> {
  const { data } = await apiClient.get<ApiResponse<ProductTemplate[]>>(
    '/modules/originals/shop/templates',
    { params: { category } },
  );
  return data.data;
}

export async function createProductTemplate(
  dto: CreateProductTemplateDto,
): Promise<ProductTemplate> {
  const { data } = await apiClient.post<ApiResponse<ProductTemplate>>(
    '/modules/originals/shop/templates',
    dto,
  );
  return data.data;
}

export async function updateProductTemplate(
  id: string,
  dto: Partial<CreateProductTemplateDto>,
): Promise<ProductTemplate> {
  const { data } = await apiClient.patch<ApiResponse<ProductTemplate>>(
    `/modules/originals/shop/templates/${id}`,
    dto,
  );
  return data.data;
}

export async function deleteProductTemplate(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/shop/templates/${id}`);
}

// ─── Admin - Orders ──────────────────────────────────────────────────
export async function getOrders(page = 1, limit = 10): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Order>>>(
    '/modules/originals/orders',
    { params: { page, limit } },
  );
  return data.data;
}

export async function getOrder(id: string): Promise<Order> {
  const { data } = await apiClient.get<ApiResponse<Order>>(`/modules/originals/orders/${id}`);
  return data.data;
}

export async function retryDelivery(id: string): Promise<Order> {
  const { data } = await apiClient.post<ApiResponse<Order>>(
    `/modules/originals/orders/${id}/retry-delivery`,
  );
  return data.data;
}

export async function refundOrder(
  id: string,
  reason?: string,
): Promise<RefundOrderResult> {
  const { data } = await apiClient.post<ApiResponse<RefundOrderResult>>(
    `/modules/originals/orders/${id}/refund`,
    { reason },
  );
  return data.data;
}

// ─── Public - Shop ───────────────────────────────────────────────────
export async function getPublicProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>('/public/originals/shop/products');
  return data.data;
}

export type PublicPaymentMethod = { method: 'atm' | 'cvs' | 'credit_card'; label: string };

export async function getPublicPaymentMethods(): Promise<PublicPaymentMethod[]> {
  const { data } = await apiClient.get<ApiResponse<PublicPaymentMethod[]>>(
    '/public/originals/shop/payment-methods',
  );
  return data.data;
}

export async function createOrder(
  items: { productId: string; quantity: number }[],
  paymentMethod?: string,
): Promise<{ order: Order; payment: PaymentResult }> {
  const { data } = await apiClient.post<ApiResponse<{ order: Order; payment: PaymentResult }>>(
    '/public/originals/shop/orders',
    { items, paymentMethod },
  );
  return data.data;
}

export async function getMyOrders(page = 1, limit = 10): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Order>>>(
    '/public/originals/shop/orders',
    { params: { page, limit } },
  );
  return data.data;
}
