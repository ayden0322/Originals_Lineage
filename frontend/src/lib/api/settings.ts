import apiClient from './client';
import type {
  ApiResponse,
  ModuleSettings,
  PaymentSettingsDto,
  LineBotSettingsDto,
  LineInviteSettingsDto,
  LineRecentSource,
  LineTestPushResult,
  GameDbSettingsDto,
  GameDbTestResult,
  GameTableMappingDto,
  FetchColumnsResult,
} from '../types';

export async function getSettings(): Promise<ModuleSettings> {
  const { data } = await apiClient.get<ApiResponse<ModuleSettings>>('/modules/originals/settings');
  return data.data;
}

export async function updatePaymentSettings(dto: PaymentSettingsDto): Promise<ModuleSettings> {
  const { data } = await apiClient.put<ApiResponse<ModuleSettings>>('/modules/originals/settings/payment', dto);
  return data.data;
}

export async function updateLineBotSettings(dto: LineBotSettingsDto): Promise<ModuleSettings> {
  const { data } = await apiClient.put<ApiResponse<ModuleSettings>>('/modules/originals/settings/line-bot', dto);
  return data.data;
}

export async function testLineBotPush(groupId: string): Promise<LineTestPushResult> {
  const { data } = await apiClient.post<ApiResponse<LineTestPushResult>>(
    '/modules/originals/settings/line-bot/test',
    { groupId },
  );
  return data.data;
}

export async function getLineRecentSources(): Promise<LineRecentSource[]> {
  const { data } = await apiClient.get<ApiResponse<LineRecentSource[]>>(
    '/modules/originals/settings/line-bot/recent-sources',
  );
  return data.data;
}

export async function updateLineInviteSettings(dto: LineInviteSettingsDto): Promise<ModuleSettings> {
  const { data } = await apiClient.put<ApiResponse<ModuleSettings>>('/modules/originals/settings/line-invite', dto);
  return data.data;
}

export async function updateGameDbSettings(dto: GameDbSettingsDto): Promise<ModuleSettings> {
  const { data } = await apiClient.put<ApiResponse<ModuleSettings>>('/modules/originals/settings/game-db', dto);
  return data.data;
}

export async function testGameDbConnection(dto: Omit<GameDbSettingsDto, 'connectionName'>): Promise<GameDbTestResult> {
  const { data } = await apiClient.post<ApiResponse<GameDbTestResult>>('/modules/originals/settings/game-db/test', dto);
  return data.data;
}

export async function updateGameTableMapping(dto: GameTableMappingDto): Promise<ModuleSettings> {
  const { data } = await apiClient.put<ApiResponse<ModuleSettings>>('/modules/originals/settings/game-table-mapping', dto);
  return data.data;
}

export async function fetchTableColumns(tableName: string): Promise<FetchColumnsResult> {
  const { data } = await apiClient.post<ApiResponse<FetchColumnsResult>>('/modules/originals/settings/game-db/columns', { tableName });
  return data.data;
}
