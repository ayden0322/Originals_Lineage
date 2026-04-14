'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  DatePicker,
  Space,
  Button,
  message,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { agentMyPlayers } from '@/lib/api/commission';
import type { CommissionPlayerTransaction } from '@/lib/types';

const { RangePicker } = DatePicker;

export default function AgentPlayersPage() {
  const [list, setList] = useState<CommissionPlayerTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentMyPlayers({
        from: range?.[0]?.toISOString(),
        to: range?.[1]?.toISOString(),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setList(data);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [range, page, pageSize]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const columns: ColumnsType<CommissionPlayerTransaction> = [
    {
      title: '時間',
      dataIndex: 'paidAt',
      width: 180,
      render: (v: string) => v.slice(0, 19).replace('T', ' '),
    },
    {
      title: '玩家',
      dataIndex: 'playerId',
      width: 180,
    },
    {
      title: '儲值金額',
      dataIndex: 'baseAmount',
      width: 120,
      render: (v: number) => Number(v).toFixed(2),
    },
    {
      title: '我的分潤',
      dataIndex: 'commissionAmount',
      width: 120,
      render: (v: number) => (
        <strong style={{ color: '#cf1322' }}>{Number(v).toFixed(2)}</strong>
      ),
    },
    {
      title: '交易 ID',
      dataIndex: 'transactionId',
      ellipsis: true,
    },
  ];

  return (
    <Card title="玩家消費明細">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="顯示自己 + 旗下子代理（如有）所帶來的玩家消費。玩家 ID 可能依管理者設定遮罩。"
      />
      <Space style={{ marginBottom: 16 }}>
        <RangePicker
          showTime
          onChange={(r) => {
            setRange(r as [Dayjs | null, Dayjs | null] | null);
            setPage(1);
          }}
        />
        <Button icon={<ReloadOutlined />} onClick={fetch}>
          重新整理
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{
          current: page,
          pageSize,
          onChange: setPage,
          // 後端目前不回 total，先用簡化分頁
          total: list.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + list.length,
          showSizeChanger: false,
        }}
      />
    </Card>
  );
}
