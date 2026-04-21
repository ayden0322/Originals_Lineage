'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Modal,
  Descriptions,
  Space,
  message,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined } from '@ant-design/icons';
import {
  agentMySettlements,
  agentSettlementDetail,
  agentExportSettlement,
} from '@/lib/api/commission';
import type {
  CommissionSettlement,
  CommissionSettlementDetail,
} from '@/lib/types';

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待確認', color: 'gold' },
  settled: { label: '已確認', color: 'blue' },
  paid: { label: '已出款', color: 'green' },
};

export default function AgentSettlementsPage() {
  const [list, setList] = useState<CommissionSettlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CommissionSettlementDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentMySettlements();
      setList(data);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const openDetail = async (s: CommissionSettlement) => {
    try {
      const d = await agentSettlementDetail(s.id);
      setDetail(d);
      setDetailOpen(true);
    } catch {
      message.error('載入詳情失敗');
    }
  };

  const handleDownload = async (s: CommissionSettlement) => {
    try {
      const blob = await agentExportSettlement(s.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement_${s.periodKey}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('下載失敗');
    }
  };

  const columns: ColumnsType<CommissionSettlement> = [
    { title: '期別', dataIndex: 'periodKey', width: 100 },
    {
      title: '範圍',
      key: 'range',
      render: (_, r) =>
        `${r.periodStart.slice(0, 10)} ~ ${r.periodEnd.slice(0, 10)}`,
    },
    {
      title: '分潤總額',
      dataIndex: 'totalCommission',
      width: 110,
      render: (v: number) => Number(v).toFixed(2),
    },
    {
      title: '加減項',
      dataIndex: 'totalAdjustment',
      width: 100,
      render: (v: number) => {
        const n = Number(v);
        return (
          <span style={{ color: n < 0 ? '#cf1322' : n > 0 ? '#3f8600' : undefined }}>
            {n.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '應付金額',
      dataIndex: 'finalAmount',
      width: 120,
      render: (v: number) => <strong>{Number(v).toFixed(2)}</strong>,
    },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => {
        const m = statusMap[s];
        return <Tag color={m?.color}>{m?.label || s}</Tag>;
      },
    },
    {
      title: '出款時間',
      dataIndex: 'paidAt',
      width: 160,
      render: (v: string | null) => v?.slice(0, 19).replace('T', ' ') || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" onClick={() => openDetail(r)}>
            詳情
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(r)}
          >
            CSV
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="結算紀錄">
      <Table
        scroll={{ x: 'max-content' }}
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{ pageSize: 12 }}
      />

      <Modal
        title={detail ? `結算詳情 - ${detail.settlement.periodKey}` : ''}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>關閉</Button>}
        width={800}
      >
        {detail ? (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="期別">
                {detail.settlement.periodKey}
              </Descriptions.Item>
              <Descriptions.Item label="狀態">
                <Tag color={statusMap[detail.settlement.status]?.color}>
                  {statusMap[detail.settlement.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="範圍" span={2}>
                {detail.settlement.periodStart.slice(0, 10)} ~{' '}
                {detail.settlement.periodEnd.slice(0, 10)}
              </Descriptions.Item>
              <Descriptions.Item label="分潤總額">
                {Number(detail.settlement.totalCommission).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="加減項">
                {Number(detail.settlement.totalAdjustment).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="應付" span={2}>
                <strong style={{ fontSize: 16 }}>
                  {Number(detail.settlement.finalAmount).toFixed(2)}
                </strong>
              </Descriptions.Item>
            </Descriptions>

            <h4>加減項明細</h4>
            <Table
              scroll={{ x: 'max-content' }}
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detail.adjustments}
              columns={[
                {
                  title: '時間',
                  dataIndex: 'createdAt',
                  width: 180,
                  render: (v: string) => v.slice(0, 19).replace('T', ' '),
                },
                { title: '類型', dataIndex: 'sourceType', width: 80 },
                {
                  title: '金額',
                  dataIndex: 'amount',
                  width: 100,
                  render: (v: number) => Number(v).toFixed(2),
                },
                { title: '原因', dataIndex: 'reason' },
              ]}
              locale={{ emptyText: '無加減項' }}
            />
          </>
        ) : (
          <Empty />
        )}
      </Modal>
    </Card>
  );
}
