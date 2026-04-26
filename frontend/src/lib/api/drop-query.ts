import apiClient from './client';
import type { ApiResponse } from '../types';

export type ItemType = 'etc' | 'weapon' | 'armor';
export type ItemTypeOrUnknown = ItemType | 'unknown';

export interface ItemSummary {
  itemId: number;
  itemName: string;
  itemType: ItemType;
}

export interface MonsterSummary {
  npcid: number;
  name: string;
  isBoss: boolean;
}

export interface MonsterDrop {
  npcid: number;
  name: string;
  isBoss: boolean;
  min: number;
  max: number;
  chancePercent: number;
  note: string;
}

export interface ItemDrop {
  itemId: number;
  itemName: string;
  itemType: ItemTypeOrUnknown;
  min: number;
  max: number;
  chancePercent: number;
  note: string;
}

export async function searchItems(q: string, page = 1, limit = 20) {
  const { data } = await apiClient.get<ApiResponse<{ items: ItemSummary[]; total: number }>>(
    '/public/originals/items/search',
    { params: { q, page, limit } },
  );
  return data.data;
}

export async function getMonstersDroppingItem(itemId: number) {
  const { data } = await apiClient.get<
    ApiResponse<{ item: ItemSummary | null; monsters: MonsterDrop[] }>
  >(`/public/originals/items/${itemId}/dropped-by`);
  return data.data;
}

export async function searchMonsters(q: string, page = 1, limit = 20) {
  const { data } = await apiClient.get<
    ApiResponse<{ items: MonsterSummary[]; total: number }>
  >('/public/originals/monsters/search', { params: { q, page, limit } });
  return data.data;
}

export async function getDropsByMonster(npcid: number) {
  const { data } = await apiClient.get<
    ApiResponse<{ monster: MonsterSummary; drops: ItemDrop[] }>
  >(`/public/originals/monsters/${npcid}/drops`);
  return data.data;
}
