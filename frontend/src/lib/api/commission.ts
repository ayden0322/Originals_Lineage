import apiClient from './client';
import type {
  ApiResponse,
  CommissionAgent,
  CommissionAgentTreeNode,
  CommissionAgentRate,
  CommissionAgentParentHistory,
  CommissionReferralLink,
  CommissionPlayerAttribution,
  CommissionSettlement,
  CommissionSettlementDetail,
  CommissionUnsettledPreview,
  CommissionClanStatsResult,
  CommissionClanRecordsResult,
  CommissionAgentRecords,
  CommissionCurrentPeriodSummary,
  CommissionSubordinateReport,
  CommissionPlayerTransaction,
  CommissionMyPlayersResponse,
  CommissionAttributionListItem,
  CommissionAgentSelf,
  AgentLoginResponse,
  CommissionPlayerTransactionsResult,
} from '../types';

const ADMIN = '/modules/originals/commission';
const AGENT = '/agent/commission';

// ─── Admin: Agents ────────────────────────────────────────────────

export async function getAgentTree(): Promise<CommissionAgentTreeNode[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionAgentTreeNode[]>>(
    `${ADMIN}/agents/tree`,
  );
  return data.data;
}

export async function getAgent(id: string): Promise<CommissionAgent> {
  const { data } = await apiClient.get<ApiResponse<CommissionAgent>>(
    `${ADMIN}/agents/${id}`,
  );
  return data.data;
}

export interface CreateAgentDto {
  name: string;
  loginAccount: string;
  password: string;
  parentId?: string | null;
  rate: number;
  contactInfo?: Record<string, unknown>;
  selfReferralAllowed?: boolean;
  canSetSubRate?: boolean;
}

export async function createAgent(dto: CreateAgentDto): Promise<CommissionAgent> {
  const { data } = await apiClient.post<ApiResponse<CommissionAgent>>(
    `${ADMIN}/agents`,
    dto,
  );
  return data.data;
}

export async function updateAgent(
  id: string,
  patch: {
    name?: string;
    contactInfo?: Record<string, unknown> | null;
    selfReferralAllowed?: boolean;
    canSetSubRate?: boolean;
  },
): Promise<CommissionAgent> {
  const { data } = await apiClient.patch<ApiResponse<CommissionAgent>>(
    `${ADMIN}/agents/${id}`,
    patch,
  );
  return data.data;
}

export async function updateAgentRate(id: string, rate: number) {
  const { data } = await apiClient.patch<ApiResponse<CommissionAgentRate>>(
    `${ADMIN}/agents/${id}/rate`,
    { rate },
  );
  return data.data;
}

export async function getAgentRateHistory(id: string): Promise<CommissionAgentRate[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionAgentRate[]>>(
    `${ADMIN}/agents/${id}/rate-history`,
  );
  return data.data;
}

export async function changeAgentParent(id: string, newParentId: string, reason?: string) {
  const { data } = await apiClient.patch<ApiResponse<CommissionAgent>>(
    `${ADMIN}/agents/${id}/parent`,
    { newParentId, reason },
  );
  return data.data;
}

export async function promoteAgent(id: string, newRate: number, reason: string) {
  const { data } = await apiClient.post<ApiResponse<CommissionAgent>>(
    `${ADMIN}/agents/${id}/promote`,
    { newRate, reason },
  );
  return data.data;
}

export async function getAgentParentHistory(id: string): Promise<CommissionAgentParentHistory[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionAgentParentHistory[]>>(
    `${ADMIN}/agents/${id}/parent-history`,
  );
  return data.data;
}

export async function suspendAgent(id: string) {
  const { data } = await apiClient.post<ApiResponse<CommissionAgent>>(
    `${ADMIN}/agents/${id}/suspend`,
  );
  return data.data;
}

export async function resumeAgent(id: string) {
  const { data } = await apiClient.post<ApiResponse<CommissionAgent>>(
    `${ADMIN}/agents/${id}/resume`,
  );
  return data.data;
}

export async function resetAgentPassword(id: string, newPassword: string) {
  const { data } = await apiClient.patch<ApiResponse<{ message: string }>>(
    `${ADMIN}/agents/${id}/password`,
    { newPassword },
  );
  return data.data;
}

// ─── Admin: Referral Links ────────────────────────────────────────

export async function listAgentLinks(agentId: string): Promise<CommissionReferralLink[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionReferralLink[]>>(
    `${ADMIN}/agents/${agentId}/links`,
  );
  return data.data;
}

export async function createAgentLink(agentId: string, label?: string) {
  const { data } = await apiClient.post<ApiResponse<CommissionReferralLink>>(
    `${ADMIN}/agents/${agentId}/links`,
    { label },
  );
  return data.data;
}

export async function toggleLink(linkId: string, active: boolean) {
  const { data } = await apiClient.patch<ApiResponse<CommissionReferralLink>>(
    `${ADMIN}/links/${linkId}`,
    { active },
  );
  return data.data;
}

// ─── Admin: Player Attribution ────────────────────────────────────

/**
 * Admin：玩家歸屬總覽列表
 */
export async function listPlayerAttributions(params?: {
  agentId?: string;
  q?: string;
  from?: string;
  to?: string;
  linkedSource?: 'cookie' | 'register' | 'manual' | 'system';
  includeSystem?: boolean;
  limit?: number;
  offset?: number;
}): Promise<CommissionAttributionListItem[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionAttributionListItem[]>>(
    `${ADMIN}/players`,
    { params },
  );
  return data.data;
}

export async function getPlayerAttribution(playerId: string) {
  const { data } = await apiClient.get<ApiResponse<CommissionPlayerAttribution>>(
    `${ADMIN}/players/${playerId}/attribution`,
  );
  return data.data;
}

export async function changePlayerAttribution(
  playerId: string,
  toAgentId: string,
  reason?: string,
) {
  const { data } = await apiClient.patch<ApiResponse<CommissionPlayerAttribution>>(
    `${ADMIN}/players/${playerId}/attribution`,
    { toAgentId, reason },
  );
  return data.data;
}

export async function listPlayerTransactions(
  playerId: string,
  params: { from?: string; to?: string; limit?: number; offset?: number } = {},
): Promise<CommissionPlayerTransactionsResult> {
  const { data } = await apiClient.get<ApiResponse<CommissionPlayerTransactionsResult>>(
    `${ADMIN}/players/${playerId}/transactions`,
    { params },
  );
  return data.data;
}

// ─── Admin: Settlements ───────────────────────────────────────────

/**
 * 當期預估（只讀聚合，不寫 DB）
 */
export async function getUnsettledPreview(): Promise<CommissionUnsettledPreview> {
  const { data } = await apiClient.get<ApiResponse<CommissionUnsettledPreview>>(
    `${ADMIN}/settlements/preview`,
  );
  return data.data;
}

/**
 * 血盟儲值統計（按期別聚合，血盟歸屬以儲值當下 snapshot 為準）
 * periodKey 不傳 → 後端回傳最新一期
 */
export async function getCommissionClanStats(
  periodKey?: string,
): Promise<CommissionClanStatsResult> {
  const { data } = await apiClient.get<ApiResponse<CommissionClanStatsResult>>(
    `${ADMIN}/settlements/clan-stats`,
    { params: periodKey ? { periodKey } : undefined },
  );
  return data.data;
}

/**
 * 單一血盟的儲值明細（drill-down）
 * - clanId 傳 null 會被轉成 'none'（SQL clan_id IS NULL）
 */
export async function getCommissionClanRecords(params: {
  periodKey: string;
  clanId: number | null;
  limit?: number;
  offset?: number;
}): Promise<CommissionClanRecordsResult> {
  const { data } = await apiClient.get<ApiResponse<CommissionClanRecordsResult>>(
    `${ADMIN}/settlements/clan-stats/records`,
    {
      params: {
        periodKey: params.periodKey,
        clanId: params.clanId === null ? 'none' : params.clanId,
        ...(params.limit != null ? { limit: params.limit } : {}),
        ...(params.offset != null ? { offset: params.offset } : {}),
      },
    },
  );
  return data.data;
}

export async function listSettlements(agentId: string): Promise<CommissionSettlement[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionSettlement[]>>(
    `${ADMIN}/settlements`,
    { params: { agentId } },
  );
  return data.data;
}

export async function getSettlementDetail(id: string): Promise<CommissionSettlementDetail> {
  const { data } = await apiClient.get<ApiResponse<CommissionSettlementDetail>>(
    `${ADMIN}/settlements/${id}`,
  );
  return data.data;
}

/**
 * 取某代理在某期的訂單明細（含分潤記錄 + 加減項 + 可選期別）
 * 無論當期或歷史皆可用
 */
export async function getAgentRecords(
  agentId: string,
  periodKey: string,
): Promise<CommissionAgentRecords> {
  const { data } = await apiClient.get<ApiResponse<CommissionAgentRecords>>(
    `${ADMIN}/settlements/records`,
    { params: { agentId, periodKey } },
  );
  return data.data;
}

export async function addAdjustment(
  settlementId: string,
  amount: number,
  reason: string,
  sourceType: 'manual' | 'bonus',
) {
  const { data } = await apiClient.post<ApiResponse<unknown>>(
    `${ADMIN}/settlements/${settlementId}/adjustments`,
    { amount, reason, sourceType },
  );
  return data.data;
}

export async function confirmSettlement(id: string) {
  const { data } = await apiClient.post<ApiResponse<CommissionSettlement>>(
    `${ADMIN}/settlements/${id}/confirm`,
  );
  return data.data;
}

export async function markSettlementPaid(id: string) {
  const { data } = await apiClient.post<ApiResponse<CommissionSettlement>>(
    `${ADMIN}/settlements/${id}/mark-paid`,
  );
  return data.data;
}

// ─── Admin: Refund ────────────────────────────────────────────────

export async function applyRefund(transactionId: string, reason?: string) {
  const { data } = await apiClient.post<ApiResponse<{ adjustmentsCreated: number }>>(
    `${ADMIN}/refunds`,
    { transactionId, reason },
  );
  return data.data;
}

// ─── Admin: Settings ──────────────────────────────────────────────

export async function getCommissionSettings(): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>(
    `${ADMIN}/settings`,
  );
  return data.data;
}

export async function updateCommissionSetting(key: string, value: unknown) {
  const { data } = await apiClient.patch<ApiResponse<unknown>>(`${ADMIN}/settings`, {
    key,
    value,
  });
  return data.data;
}

// ─── Agent self ───────────────────────────────────────────────────

export async function agentLogin(loginAccount: string, password: string) {
  const { data } = await apiClient.post<ApiResponse<AgentLoginResponse>>(
    `${AGENT}/auth/login`,
    { loginAccount, password },
  );
  return data.data;
}

export async function agentMe(): Promise<CommissionAgentSelf> {
  const { data } = await apiClient.get<ApiResponse<CommissionAgentSelf>>(`${AGENT}/me`);
  return data.data;
}

export async function agentMyLinks(): Promise<CommissionReferralLink[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionReferralLink[]>>(
    `${AGENT}/me/links`,
  );
  return data.data;
}

export async function agentCreateMyLink(label?: string) {
  const { data } = await apiClient.post<ApiResponse<CommissionReferralLink>>(
    `${AGENT}/me/links`,
    { label },
  );
  return data.data;
}

export async function agentToggleMyLink(id: string, active: boolean) {
  const { data } = await apiClient.patch<ApiResponse<CommissionReferralLink>>(
    `${AGENT}/me/links/${id}`,
    { active },
  );
  return data.data;
}

export async function agentSubordinates(): Promise<CommissionSubordinateReport[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionSubordinateReport[]>>(
    `${AGENT}/me/subordinates`,
  );
  return data.data;
}

export async function agentSetSubRate(subId: string, rate: number) {
  const { data } = await apiClient.patch<ApiResponse<unknown>>(
    `${AGENT}/me/subordinates/${subId}/rate`,
    { rate },
  );
  return data.data;
}

export async function agentCurrentPeriod(): Promise<CommissionCurrentPeriodSummary> {
  const { data } = await apiClient.get<ApiResponse<CommissionCurrentPeriodSummary>>(
    `${AGENT}/me/current-period`,
  );
  return data.data;
}

export async function agentMySettlements(): Promise<CommissionSettlement[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionSettlement[]>>(
    `${AGENT}/me/settlements`,
  );
  return data.data;
}

export async function agentSettlementDetail(id: string): Promise<CommissionSettlementDetail> {
  const { data } = await apiClient.get<ApiResponse<CommissionSettlementDetail>>(
    `${AGENT}/me/settlements/${id}`,
  );
  return data.data;
}

export function agentSettlementCsvUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  return `${base}${AGENT}/me/settlements/${id}/export`;
}

export async function agentExportSettlement(id: string): Promise<Blob> {
  const res = await apiClient.get(`${AGENT}/me/settlements/${id}/export`, {
    responseType: 'blob',
  });
  return res.data;
}

/**
 * 代理玩家清單（含註冊未消費者）— /agent/players 頁面用
 */
export async function agentMyPlayers(params?: {
  from?: string;
  to?: string;
  joinedMonth?: string;
  limit?: number;
  offset?: number;
}): Promise<CommissionMyPlayersResponse> {
  const { data } = await apiClient.get<ApiResponse<CommissionMyPlayersResponse>>(
    `${AGENT}/me/players`,
    { params },
  );
  return data.data;
}

/**
 * 代理玩家消費交易明細（每筆交易一列）
 */
export async function agentMyTransactions(params?: {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<CommissionPlayerTransaction[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionPlayerTransaction[]>>(
    `${AGENT}/me/transactions`,
    { params },
  );
  return data.data;
}

export async function agentChangePassword(oldPassword: string, newPassword: string) {
  const { data } = await apiClient.patch<ApiResponse<{ message: string }>>(
    `${AGENT}/me/password`,
    { oldPassword, newPassword },
  );
  return data.data;
}
