import apiClient from './client';
import type { ApiResponse, PaginatedResponse, Product, Order, CreateProductDto, PaymentResult } from '../types';

// Admin - Products
export async function getProducts(page = 1, limit = 10): Promise<PaginatedResponse<Product>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Product>>>('/modules/originals/products', { params: { page, limit } });
  return data.data;
}

export async function createProduct(dto: CreateProductDto): Promise<Product> {
  const { data } = await apiClient.post<ApiResponse<Product>>('/modules/originals/products', dto);
  return data.data;
}

export async function updateProduct(id: string, dto: Partial<CreateProductDto>): Promise<Product> {
  const { data } = await apiClient.patch<ApiResponse<Product>>(`/modules/originals/products/${id}`, dto);
  return data.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/modules/originals/products/${id}`);
}

// Admin - Orders
export async function getOrders(page = 1, limit = 10): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Order>>>('/modules/originals/orders', { params: { page, limit } });
  return data.data;
}

export async function getOrder(id: string): Promise<Order> {
  const { data } = await apiClient.get<ApiResponse<Order>>(`/modules/originals/orders/${id}`);
  return data.data;
}

export async function retryDelivery(id: string): Promise<Order> {
  const { data } = await apiClient.post<ApiResponse<Order>>(`/modules/originals/orders/${id}/retry-delivery`);
  return data.data;
}

// Public - Shop
export async function getPublicProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>('/public/originals/shop/products');
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
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Order>>>('/public/originals/shop/orders', { params: { page, limit } });
  return data.data;
}
