'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Drawer,
  Table,
  Tag,
  Space,
  Spin,
  Alert,
  Typography,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getCommissionClanRecords } from '@/lib/api/commission';
import type {
  CommissionClanRecordItem,
  CommissionClanRecordsResult,
} from '@/lib/types';

const { Text } = Typography;

interface Props {
  open: boolean;
  periodKey: string;
  /** null = 無血盟 */
  clanId: number | null;
  clanName: string | null;
  onClose: () => void;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const PAGE_SIZE = 50;

export default function ClanRecordsDrawer({
  open,
  periodKey,
  clanId,
  clanName,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CommissionClanRecordsResult | null>(null);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(
    async (targetPage: number) => {
      if (!open || !periodKey) return;
      setLoading(true);
      try {
        const res = await getCommissionClanRecords({
          periodKey,
          clanId,
          limit: PAGE_SIZE,
          offset: (targetPage - 1) * PAGE_SIZE,
        });
        setData(res);
      } finally {
        setLoading(false);
      }
    },
    [open, periodKey, clanId],
  );

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchData(1);
    } else {
      setData(null);
    }
  }, [open, fetchData]);

  const isNoClan = clanId === null;
  const title = isNoClan
    ? `血盟儲值明細 - 無血盟 · ${periodKey}`
    : `血盟儲值明細 - ${clanName ?? ''}${clanId !== null ? ` #${clanId}` : ''} · ${periodKey}`;

  const columns: ColumnsType<CommissionClanRecordItem> = [
    {
      title: '儲值時間',
      dataIndex: 'paidAt',
      width: 170,
      render: (v: string) => fmtTime(v),
    },
    {
      title: '玩家帳號',
      dataIndex: 'playerAccount',
      width: 160,
      render: (v: string | null) =>
        v ?? <Text type="secondary">(無)</Text>,
    },
    {
      title: '儲值金額',
      dataIndex: 'baseAmount',
      width: 130,
      align: 'right',
      render: (v: number, r) => {
        const n = Number(v).toFixed(2);
        if (r.isRefunded) {
          return (
            <Tooltip title="此筆交易已被退款沖銷，金額仍計入摘要的「儲值總額」（gross），退款金額單獨計入「已退款」">
              <Text
                style={{
                  color: '#cf1322',
                  textDecoration: 'line-through',
                }}
              >
                {n}
              </Text>
            </Tooltip>
          );
        }
        return <strong>{n}</strong>;
      },
    },
    {
      title: '狀態',
      dataIndex: 'isRefunded',
      width: 90,
      render: (v: boolean) =>
        v ? (
          <Tag color="red">已退款</Tag>
        ) : (
          <Tag color="green">正常</Tag>
        ),
    },
    {
      title: '代理',
      key: 'agent',
      width: 200,
      render: (_, r) => {
        if (r.agentIsSystem) {
          return <Tag>SYSTEM（無歸屬）</Tag>;
        }
        return (
          <Space size={4}>
            {r.agentCode && <strong>{r.agentCode}</strong>}
            <span>{r.agentName ?? '-'}</span>
          </Space>
        );
      },
    },
    {
      title: '交易 ID',
      dataIndex: 'transactionId',
      ellipsis: true,
      render: (v: string) => (
        <Text code copyable={{ text: v }}>
          {v}
        </Text>
      ),
    },
  ];

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width={960}
      destroyOnClose
    >
      {isNoClan && (
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          showIcon
          message="「無血盟」=儲值當下玩家不屬於任何血盟，或遊戲庫查不到該角色"
        />
      )}

      <div style={{ marginBottom: 12 }}>
        <Space>
          <span>期別：</span>
          <Tag color="blue">{periodKey}</Tag>
          <span>總筆數：</span>
          <strong>{data?.total ?? 0}</strong>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Table
          rowKey="recordId"
          size="small"
          columns={columns}
          dataSource={data?.items ?? []}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            showSizeChanger: false,
            onChange: (p) => {
              setPage(p);
              fetchData(p);
            },
          }}
        />
      </Spin>
    </Drawer>
  );
}
