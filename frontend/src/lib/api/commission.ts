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
  CommissionCurrentPeriodSummary,
  CommissionSubordinateReport,
  CommissionPlayerTransaction,
  CommissionAgentSelf,
  AgentLoginResponse,
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

// ─── Admin: Settlements ───────────────────────────────────────────

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

export async function agentMyPlayers(params?: {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<CommissionPlayerTransaction[]> {
  const { data } = await apiClient.get<ApiResponse<CommissionPlayerTransaction[]>>(
    `${AGENT}/me/players`,
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
