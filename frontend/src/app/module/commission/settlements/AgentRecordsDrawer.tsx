'use client';

import { useEffect, useState } from 'react';
import {
  Drawer,
  Select,
  Table,
  Tag,
  Typography,
  Space,
  Divider,
  Alert,
  Spin,
  Empty,
  Row,
  Col,
  Statistic,
  message,
} from 'antd';
import { getAgentRecords } from '@/lib/api/commission';
import type {
  CommissionAgentRecords,
  CommissionAgentRecordItem,
  CommissionAgentAdjustmentItem,
} from '@/lib/types';

const { Text } = Typography;

interface Props {
  open: boolean;
  agentId: string | null;
  agentName: string;
  agentCode?: string | null;
  initialPeriodKey: string;
  onClose: () => void;
}

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}NT$ ${abs.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRate(r: number): string {
  // rate_snapshot 型別為 decimal(5,4)，值為 0~1 之間的小數
  return `${(r * 100).toFixed(2)}%`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SOURCE_TYPE_LABEL: Record<CommissionAgentAdjustmentItem['sourceType'], string> = {
  refund: '退款沖銷',
  manual: '手動調整',
  bonus: '補發獎金',
};

const SOURCE_TYPE_COLOR: Record<CommissionAgentAdjustmentItem['sourceType'], string> = {
  refund: 'red',
  manual: 'blue',
  bonus: 'green',
};

export default function AgentRecordsDrawer({
  open,
  agentId,
  agentName,
  agentCode,
  initialPeriodKey,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [periodKey, setPeriodKey] = useState<string>(initialPeriodKey);
  const [data, setData] = useState<CommissionAgentRecords | null>(null);

  // 當 Drawer 開啟或 agentId/periodKey 改變時，重新載入
  useEffect(() => {
    if (open) {
      setPeriodKey(initialPeriodKey);
    }
  }, [open, initialPeriodKey]);

  useEffect(() => {
    if (!open || !agentId || !periodKey) return;
    let cancelled = false;
    setLoading(true);
    getAgentRecords(agentId, periodKey)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) message.error('載入訂單明細失敗');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, agentId, periodKey]);

  const recordColumns = [
    {
      title: '交易時間',
      dataIndex: 'paidAt',
      key: 'paidAt',
      width: 150,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{fmtTime(v)}</Text>,
    },
    {
      title: '玩家帳號',
      dataIndex: 'playerAccount',
      key: 'playerAccount',
      width: 150,
      render: (v: string | null) =>
        v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '訂單金額',
      dataIndex: 'baseAmount',
      key: 'baseAmount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '層級',
      dataIndex: 'level',
      key: 'level',
      width: 70,
      render: (v: number) => (
        <Tag color={v === 1 ? 'gold' : 'cyan'}>{v === 1 ? '一級' : '二級'}</Tag>
      ),
    },
    {
      title: '分潤率',
      dataIndex: 'rateSnapshot',
      key: 'rateSnapshot',
      width: 90,
      align: 'right' as const,
      render: (v: number) => fmtRate(v),
    },
    {
      title: '分潤金額',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          {fmtMoney(v)}
        </Text>
      ),
    },
    {
      title: '交易 ID',
      dataIndex: 'transactionId',
      key: 'transactionId',
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
          {v}
        </Text>
      ),
    },
  ];

  const adjColumns = [
    {
      title: '時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{fmtTime(v)}</Text>,
    },
    {
      title: '類型',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 100,
      render: (v: CommissionAgentAdjustmentItem['sourceType']) => (
        <Tag color={SOURCE_TYPE_COLOR[v]}>{SOURCE_TYPE_LABEL[v]}</Tag>
      ),
    },
    {
      title: '金額',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: v < 0 ? '#ff4d4f' : '#52c41a' }}>
          {fmtMoney(v)}
        </Text>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Text>{v}</Text>,
    },
    {
      title: '來源交易',
      dataIndex: 'sourceTransactionId',
      key: 'sourceTransactionId',
      width: 160,
      render: (v: string | null) =>
        v ? (
          <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {v}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  const availablePeriods = data?.availablePeriods ?? [];
  const periodOptions = (
    availablePeriods.length > 0 ? availablePeriods : [periodKey].filter(Boolean)
  ).map((p) => ({ label: p, value: p }));

  return (
    <Drawer
      title={
        <Space>
          <span>「{agentName}」</span>
          {agentCode && <Tag>{agentCode}</Tag>}
          <span>的訂單明細</span>
        </Space>
      }
      placement="right"
      width={960}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 期別切換 */}
        <Space>
          <Text>期別：</Text>
          <Select
            style={{ width: 160 }}
            value={periodKey}
            onChange={(v) => setPeriodKey(v)}
            options={periodOptions}
          />
          <Text type="secondary">
            共 {availablePeriods.length} 期有資料
          </Text>
        </Space>

        <Spin spinning={loading}>
          {!data ? (
            <Empty description="尚無資料" />
          ) : (
            <>
              {/* 摘要卡 */}
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="訂單筆數" value={data.summary.recordCount} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="業績總額"
                    value={data.summary.totalBaseAmount}
                    precision={2}
                    prefix="NT$"
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="分潤總額"
                    value={data.summary.totalCommission}
                    precision={2}
                    prefix="NT$"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="加減項"
                    value={data.summary.totalAdjustment}
                    precision={2}
                    prefix="NT$"
                    valueStyle={{
                      color: data.summary.totalAdjustment < 0 ? '#ff4d4f' : undefined,
                    }}
                  />
                </Col>
              </Row>

              <Alert
                type="info"
                showIcon
                message={
                  <Space>
                    <span>淨分潤（= 分潤總額 + 加減項）：</span>
                    <Text strong style={{ fontSize: 16 }}>
                      {fmtMoney(data.summary.netCommission)}
                    </Text>
                  </Space>
                }
              />

              <Divider orientation="left" plain>
                分潤記錄（{data.records.length} 筆）
              </Divider>
              <Table<CommissionAgentRecordItem>
                size="small"
                rowKey="recordId"
                columns={recordColumns}
                dataSource={data.records}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                locale={{ emptyText: '本期尚無分潤記錄' }}
                scroll={{ x: 'max-content' }}
              />

              {data.adjustments.length > 0 && (
                <>
                  <Divider orientation="left" plain>
                    加減項 / 退款沖銷（{data.adjustments.length} 筆）
                  </Divider>
                  <Table<CommissionAgentAdjustmentItem>
                    size="small"
                    rowKey="id"
                    columns={adjColumns}
                    dataSource={data.adjustments}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                  />
                </>
              )}
            </>
          )}
        </Spin>
      </Space>
    </Drawer>
  );
}
