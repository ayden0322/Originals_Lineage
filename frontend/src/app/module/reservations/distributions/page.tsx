'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Button,
  Table,
  Tag,
  Typography,
  message,
  Space,
  Modal,
  Drawer,
  Select,
  Input,
  Progress,
  Alert,
  Descriptions,
  List,
} from 'antd';
import {
  SendOutlined,
  ReloadOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {
  getDistributionSummary,
  getClaimsByMilestone,
  markClaimsStatus,
  getReservationStats,
  validateMilestoneForDistribution,
  startDistribution,
  distributeAllReached,
} from '@/lib/api/reserve';
import type {
  MilestoneDistribution,
  MilestoneValidationResult,
  RewardClaim,
  RewardClaimStatus,
  ReservationStats,
} from '@/lib/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_META: Record<RewardClaimStatus, { label: string; color: string }> = {
  pending: { label: '待發送', color: 'orange' },
  processing: { label: '寄送中', color: 'blue' },
  sent: { label: '已發送', color: 'green' },
  failed: { label: '失敗', color: 'red' },
};

const POLL_INTERVAL_MS = 3000;

export default function DistributionsPage() {
  const [summaries, setSummaries] = useState<MilestoneDistribution[]>([]);
  const [stats, setStats] = useState<ReservationStats | null>(null);
  const [loading, setLoading] = useState(false);

  // 發放確認 modal
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationResult, setValidationResult] =
    useState<MilestoneValidationResult | null>(null);
  const [targetMilestone, setTargetMilestone] =
    useState<MilestoneDistribution | null>(null);
  const [starting, setStarting] = useState(false);

  // Drawer: 檢視某里程碑的 claim 明細
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentMilestone, setCurrentMilestone] =
    useState<MilestoneDistribution | null>(null);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RewardClaimStatus | undefined>();
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);

  // 手動標狀態 modal
  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [markStatus, setMarkStatus] = useState<RewardClaimStatus>('sent');
  const [markNote, setMarkNote] = useState('');

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [summary, st] = await Promise.all([
        getDistributionSummary(),
        getReservationStats(),
      ]);
      setSummaries(summary);
      setStats(st);
    } catch {
      message.error('載入失敗');
    }
  }, []);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    try {
      await fetchData();
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  // 若有任何 processing 或 pending claim 存在，啟用 3 秒輪詢以即時顯示進度
  useEffect(() => {
    const hasActive = summaries.some(
      (s) => s.processing > 0 || s.pending > 0,
    );
    if (hasActive && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(fetchData, POLL_INTERVAL_MS);
    } else if (!hasActive && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [summaries, fetchData]);

  const openDistributeModal = async (milestone: MilestoneDistribution) => {
    setTargetMilestone(milestone);
    setValidationResult(null);
    setDistributeModalOpen(true);
    setValidationLoading(true);
    try {
      const res = await validateMilestoneForDistribution(milestone.milestoneId);
      setValidationResult(res);
    } catch {
      message.error('驗證失敗，請稍後重試');
      setDistributeModalOpen(false);
    } finally {
      setValidationLoading(false);
    }
  };

  const handleConfirmStart = async () => {
    if (!targetMilestone) return;
    setStarting(true);
    try {
      const res = await startDistribution(targetMilestone.milestoneId);
      message.success(
        `發放已啟動：新增 ${res.created} 筆、已存在 ${res.skipped} 筆，背景寄送進行中`,
      );
      setDistributeModalOpen(false);
      fetchData();
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { message?: string | { message?: string } } };
      };
      const responseMsg = axiosErr?.response?.data?.message;
      const msg =
        typeof responseMsg === 'string'
          ? responseMsg
          : responseMsg?.message ?? '發放啟動失敗';
      message.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const handleDistributeAll = async () => {
    Modal.confirm({
      title: '一鍵發放所有達標里程碑',
      content: '系統會檢查所有達標且綁定道具的里程碑，並背景啟動寄送。',
      onOk: async () => {
        try {
          const res = await distributeAllReached();
          message.success(
            `已啟動 ${res.startedMilestoneIds.length} 個里程碑的發放流程`,
          );
          fetchData();
        } catch {
          message.error('批次啟動失敗');
        }
      },
    });
  };

  const openClaimDrawer = async (milestone: MilestoneDistribution) => {
    setCurrentMilestone(milestone);
    setStatusFilter(undefined);
    setSelectedClaimIds([]);
    setDrawerOpen(true);
    await loadClaims(milestone.milestoneId);
  };

  const loadClaims = async (
    milestoneId: string,
    status?: RewardClaimStatus,
  ) => {
    setClaimsLoading(true);
    try {
      const res = await getClaimsByMilestone(milestoneId, {
        status,
        page: 1,
        limit: 500,
      });
      setClaims(
        (res as { data?: RewardClaim[]; items?: RewardClaim[] }).data ||
          res.items ||
          [],
      );
    } catch {
      message.error('載入名單失敗');
    } finally {
      setClaimsLoading(false);
    }
  };

  const handleStatusFilterChange = (value: RewardClaimStatus | undefined) => {
    setStatusFilter(value);
    setSelectedClaimIds([]);
    if (currentMilestone) loadClaims(currentMilestone.milestoneId, value);
  };

  const handleMarkSubmit = async () => {
    if (selectedClaimIds.length === 0) {
      message.warning('請先勾選要更新的紀錄');
      return;
    }
    try {
      const res = await markClaimsStatus({
        claimIds: selectedClaimIds,
        status: markStatus,
        note: markNote || undefined,
      });
      message.success(`已更新 ${res.updated} 筆`);
      setMarkModalOpen(false);
      setMarkNote('');
      setSelectedClaimIds([]);
      if (currentMilestone) {
        loadClaims(currentMilestone.milestoneId, statusFilter);
      }
      fetchData();
    } catch {
      message.error('更新失敗');
    }
  };

  const summaryColumns = [
    {
      title: '門檻',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 100,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '獎勵',
      dataIndex: 'rewardName',
      key: 'rewardName',
    },
    {
      title: '達成狀態',
      key: 'reached',
      width: 180,
      render: (_: unknown, r: MilestoneDistribution) => {
        const display = stats?.displayCount ?? 0;
        const reached = display >= r.threshold;
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Tag color={reached ? 'green' : 'default'}>
              {reached ? '已達成' : '未達成'}
            </Tag>
            <Progress
              percent={Math.min(100, Math.round((display / r.threshold) * 100))}
              size="small"
              showInfo={false}
            />
          </Space>
        );
      },
    },
    {
      title: '已建立',
      dataIndex: 'total',
      key: 'total',
      width: 90,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '狀態分布',
      key: 'breakdown',
      width: 320,
      render: (_: unknown, r: MilestoneDistribution) => (
        <Space size={4} wrap>
          <Tag color="orange">待 {r.pending}</Tag>
          <Tag color="blue" icon={r.processing > 0 ? <LoadingOutlined /> : null}>
            寄送中 {r.processing}
          </Tag>
          <Tag color="green">已發 {r.sent}</Tag>
          <Tag color="red">失敗 {r.failed}</Tag>
          {r.total > 0 && (
            <Progress
              type="circle"
              size={28}
              percent={Math.round((r.sent / r.total) * 100)}
            />
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, r: MilestoneDistribution) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<SendOutlined />}
            onClick={() => openDistributeModal(r)}
          >
            開始發放
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openClaimDrawer(r)}
          >
            檢視
          </Button>
        </Space>
      ),
    },
  ];

  const claimColumns = [
    {
      title: '遊戲帳號',
      dataIndex: 'gameAccountSnapshot',
      key: 'gameAccountSnapshot',
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: RewardClaimStatus) => (
        <Tag
          color={STATUS_META[s].color}
          icon={s === 'processing' ? <LoadingOutlined /> : null}
        >
          {STATUS_META[s].label}
        </Tag>
      ),
    },
    {
      title: '發送時間',
      dataIndex: 'sentAt',
      key: 'sentAt',
      width: 170,
      render: (v: string | null) =>
        v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: '備註',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
    },
    {
      title: '建立時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          新兵報到 — 發獎管理
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleDistributeAll}
          >
            一鍵發放達標里程碑
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={initialLoad}
            loading={loading}
          >
            重新整理
          </Button>
        </Space>
      </div>

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message={`實際預約人數：${stats?.actualCount ?? 0}；顯示人數：${stats?.displayCount ?? 0}（含種子 ${stats?.countBase ?? 0}）`}
        description="「開始發放」會跑完整檢查 → 建立批次 → 背景寄送到遊戲信件系統（含 4 次重試與反查）。有 pending/processing 時每 3 秒自動更新。"
      />

      <Table
        scroll={{ x: 'max-content' }}
        rowKey="milestoneId"
        columns={summaryColumns}
        dataSource={summaries}
        loading={loading}
        pagination={false}
      />

      {/* ─── 發放確認 Modal ─── */}
      <Modal
        title={
          targetMilestone
            ? `開始發放 — ${targetMilestone.rewardName}`
            : '開始發放'
        }
        open={distributeModalOpen}
        onCancel={() => setDistributeModalOpen(false)}
        onOk={handleConfirmStart}
        okText="確認開始發放"
        okButtonProps={{
          disabled: !validationResult?.ok || validationLoading,
          loading: starting,
        }}
        confirmLoading={starting}
        width={600}
      >
        {validationLoading && <Text>檢查中...</Text>}
        {validationResult && (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="門檻">
                {validationResult.context.threshold?.toLocaleString() ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="目前顯示人數">
                {validationResult.context.displayCount.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="實際預約人數">
                {validationResult.context.actualReservationCount.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="綁定道具">
                {validationResult.milestone?.gameItemId ? (
                  <>
                    [{validationResult.milestone.gameItemId}]{' '}
                    {validationResult.milestone.gameItemName ?? '—'} ×{' '}
                    {validationResult.milestone.gameItemQuantity ?? 1}
                  </>
                ) : (
                  <Tag color="error">未綁定</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="結算狀態">
                {validationResult.context.deadlineAt
                  ? `截止於 ${dayjs(validationResult.context.deadlineAt).format('YYYY-MM-DD HH:mm')}`
                  : '未設定截止日'}
                {validationResult.context.isDistributionLocked && (
                  <Tag color="orange" style={{ marginLeft: 8 }}>
                    已鎖定
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            {validationResult.ok ? (
              <Alert
                style={{ marginTop: 12 }}
                type="success"
                showIcon
                message="檢查全部通過，可以開始發放"
                description="執行後系統會建立 pending claim，並在背景以 5 並行 worker 處理寄送（含 4 次重試）。即使關閉此頁面也會繼續進行。"
              />
            ) : (
              <Alert
                style={{ marginTop: 12 }}
                type="error"
                showIcon
                message="發放前檢查未通過"
                description={
                  <List
                    size="small"
                    dataSource={validationResult.issues}
                    renderItem={(item) => (
                      <List.Item>
                        <Text>
                          <Tag>{item.code}</Tag> {item.message}
                        </Text>
                      </List.Item>
                    )}
                  />
                }
              />
            )}
          </>
        )}
      </Modal>

      {/* ─── 檢視清單 Drawer ─── */}
      <Drawer
        title={
          currentMilestone
            ? `${currentMilestone.rewardName} — 發放清單`
            : '發放清單'
        }
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Space style={{ marginBottom: 12 }} wrap>
          <Select
            allowClear
            placeholder="依狀態篩選"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={handleStatusFilterChange}
            options={[
              { value: 'pending', label: '待發送' },
              { value: 'processing', label: '寄送中' },
              { value: 'sent', label: '已發送' },
              { value: 'failed', label: '失敗' },
            ]}
          />
          <Button
            type="primary"
            disabled={selectedClaimIds.length === 0}
            onClick={() => {
              setMarkStatus('sent');
              setMarkModalOpen(true);
            }}
          >
            手動標記已發送（{selectedClaimIds.length}）
          </Button>
          <Button
            danger
            disabled={selectedClaimIds.length === 0}
            onClick={() => {
              setMarkStatus('failed');
              setMarkModalOpen(true);
            }}
          >
            標記失敗
          </Button>
          <Button
            disabled={selectedClaimIds.length === 0}
            onClick={() => {
              setMarkStatus('pending');
              setMarkModalOpen(true);
            }}
          >
            退回待發送
          </Button>
        </Space>

        <Table
          scroll={{ x: 'max-content' }}
          rowKey="id"
          size="small"
          columns={claimColumns}
          dataSource={claims}
          loading={claimsLoading}
          rowSelection={{
            selectedRowKeys: selectedClaimIds,
            onChange: (keys) => setSelectedClaimIds(keys as string[]),
          }}
          pagination={{ pageSize: 20 }}
        />
      </Drawer>

      {/* ─── 手動標狀態 Modal ─── */}
      <Modal
        title="批次更新狀態"
        open={markModalOpen}
        onOk={handleMarkSubmit}
        onCancel={() => setMarkModalOpen(false)}
        okText="確認"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            將 <b>{selectedClaimIds.length}</b> 筆紀錄標記為{' '}
            <Tag color={STATUS_META[markStatus].color}>
              {STATUS_META[markStatus].label}
            </Tag>
          </Text>
          <Input.TextArea
            rows={3}
            placeholder="備註（可選；失敗原因、信件編號等）"
            value={markNote}
            onChange={(e) => setMarkNote(e.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
}
