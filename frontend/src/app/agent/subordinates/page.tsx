'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Modal,
  InputNumber,
  Form,
  message,
  Alert,
  Empty,
  Space,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined } from '@ant-design/icons';
import {
  agentMe,
  agentSubordinates,
  agentSetSubRate,
} from '@/lib/api/commission';
import type {
  CommissionAgentSelf,
  CommissionSubordinateReport,
} from '@/lib/types';

export default function AgentSubordinatesPage() {
  const [me, setMe] = useState<CommissionAgentSelf | null>(null);
  const [list, setList] = useState<CommissionSubordinateReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<CommissionSubordinateReport | null>(null);
  const [newRate, setNewRate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [m, subs] = await Promise.all([agentMe(), agentSubordinates()]);
      setMe(m);
      setList(subs);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (loading || !me) return null;

  if (me.level !== 1) {
    return <Empty description="此頁僅一級代理（A）可使用" />;
  }

  const handleSetRate = async () => {
    if (!editTarget || newRate === null) return;
    try {
      setSubmitting(true);
      await agentSetSubRate(editTarget.id, newRate);
      message.success('已即時生效');
      setEditTarget(null);
      fetch();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || '更新失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<CommissionSubordinateReport> = [
    {
      title: '代碼',
      dataIndex: 'code',
      width: 100,
      render: (v: string) => <strong>{v}</strong>,
    },
    { title: '名稱', dataIndex: 'name' },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 100,
      render: (s: string) =>
        s === 'active' ? <Tag color="green">啟用</Tag> : <Tag color="red">停權</Tag>,
    },
    {
      title: '本期帶來業績',
      dataIndex: 'bringInAmount',
      width: 140,
      render: (v: number) => Number(v).toFixed(2),
    },
    {
      title: '本期 B 自己分潤',
      dataIndex: 'bSelfCommission',
      width: 140,
      render: (v: number) => Number(v).toFixed(2),
    },
    {
      title: '交易筆數',
      dataIndex: 'transactionCount',
      width: 100,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, row) => (
        <Space>
          {me.canSetSubRate && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditTarget(row);
                setNewRate(null);
              }}
              disabled={row.status !== 'active'}
            >
              調比例
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card title="子代理業績">
      {!me.canSetSubRate && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="管理者尚未開放你調整子代理比例。如需調整請聯絡管理者。"
        />
      )}
      {me.canSetSubRate && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="管理者已開放你調整子代理比例。變更會即時生效，歷史分潤不受影響。"
        />
      )}
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="新增子代理請聯絡管理者"
        description="所有子代理由總管理者統一建立。如需擴充團隊，請聯絡管理者新增。"
      />
      <Table
        scroll={{ x: 'max-content' }}
        rowKey="id"
        columns={columns}
        dataSource={list}
        pagination={false}
      />

      <Modal
        title={`調整 ${editTarget?.code} 比例`}
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={handleSetRate}
        confirmLoading={submitting}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="此比例為「從你拿到的分潤池中切給該子代理」的比例（0~1）。例如設 0.6 = 60%。"
        />
        <Form layout="vertical">
          <Form.Item label="新比例" required>
            <InputNumber
              min={0}
              max={1}
              step={0.05}
              value={newRate}
              onChange={(v) => setNewRate(v as number)}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
