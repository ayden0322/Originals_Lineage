'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Table,
  Tag,
  Typography,
  message,
  Space,
  Popconfirm,
  Modal,
  Drawer,
  Select,
  Input,
  Progress,
  Alert,
} from 'antd';
import { SendOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import {
  getDistributionSummary,
  distributeMilestone,
  getClaimsByMilestone,
  markClaimsStatus,
  getReservationStats,
} from '@/lib/api/reserve';
import type {
  MilestoneDistribution,
  RewardClaim,
  RewardClaimStatus,
  ReservationStats,
} from '@/lib/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_META: Record<RewardClaimStatus, { label: string; color: string }> = {
  pending: { label: '待發送', color: 'orange' },
  sent: { label: '已發送', color: 'green' },
  failed: { label: '失敗', color: 'red' },
};

export default function DistributionsPage() {
  const [summaries, setSummaries] = useState<MilestoneDistribution[]>([]);
  const [stats, setStats] = useState<ReservationStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Drawer: 檢視某里程碑的 claim 明細
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentMilestone, setCurrentMilestone] =
    useState<MilestoneDistribution | null>(null);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RewardClaimStatus | undefined>();
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);

  // Mark modal
  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [markStatus, setMarkStatus] = useState<RewardClaimStatus>('sent');
  const [markNote, setMarkNote] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, st] = await Promise.all([
        getDistributionSummary(),
        getReservationStats(),
      ]);
      setSummaries(summary);
      setStats(st);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDistribute = async (milestoneId: string) => {
    try {
      const res = await distributeMilestone(milestoneId);
      message.success(
        `批次建立完成：新增 ${res.created} 筆，已存在 ${res.skipped} 筆（預約者共 ${res.totalReservations}）`,
      );
      fetchData();
    } catch {
      message.error('發放失敗');
    }
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
      setClaims((res as { data?: RewardClaim[]; items?: RewardClaim[] }).data || res.items || []);
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
        const actual = stats?.actualCount ?? 0;
        const reached = actual >= r.threshold;
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Tag color={reached ? 'green' : 'default'}>
              {reached ? '已達成' : '未達成'}
            </Tag>
            <Progress
              percent={Math.min(100, Math.round((actual / r.threshold) * 100))}
              size="small"
              showInfo={false}
            />
          </Space>
        );
      },
    },
    {
      title: '已建立 claim',
      dataIndex: 'total',
      key: 'total',
      width: 110,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '待發 / 已發 / 失敗',
      key: 'breakdown',
      width: 220,
      render: (_: unknown, r: MilestoneDistribution) => (
        <Space size={4}>
          <Tag color="orange">{r.pending} 待發</Tag>
          <Tag color="green">{r.sent} 已發</Tag>
          <Tag color="red">{r.failed} 失敗</Tag>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, r: MilestoneDistribution) => (
        <Space>
          <Popconfirm
            title="建立發放批次？"
            description={`將為尚未建立 claim 的預約者新增 pending 紀錄（actual: ${stats?.actualCount ?? 0}）`}
            onConfirm={() => handleDistribute(r.milestoneId)}
          >
            <Button size="small" type="primary" icon={<SendOutlined />}>
              建立批次
            </Button>
          </Popconfirm>
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
      width: 90,
      render: (s: RewardClaimStatus) => (
        <Tag color={STATUS_META[s].color}>{STATUS_META[s].label}</Tag>
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
          事前預約 — 發獎管理
        </Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          重新整理
        </Button>
      </div>

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message={`目前實際預約人數：${stats?.actualCount ?? 0}；顯示人數：${stats?.displayCount ?? 0}（含種子 ${stats?.countBase ?? 0}）`}
        description="建議流程：達成門檻 → 建立批次（pending）→ 人工寄送遊戲信件 → 在檢視頁勾選後標記已發送。"
      />

      <Table
        rowKey="milestoneId"
        columns={summaryColumns}
        dataSource={summaries}
        loading={loading}
        pagination={false}
      />

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
            標記已發送（{selectedClaimIds.length}）
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
