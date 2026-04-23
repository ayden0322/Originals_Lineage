'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  DatePicker,
  Space,
  Button,
  Tag,
  message,
  Alert,
  Statistic,
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { agentMyPlayers } from '@/lib/api/commission';
import type { CommissionMyPlayerItem } from '@/lib/types';

const { RangePicker } = DatePicker;

const SOURCE_LABEL: Record<CommissionMyPlayerItem['linkedSource'], { text: string; color: string }> = {
  cookie: { text: '連結點擊', color: 'blue' },
  register: { text: '註冊綁定', color: 'green' },
  manual: { text: '管理者手動', color: 'orange' },
  system: { text: '系統', color: 'default' },
};

export default function AgentPlayersPage() {
  const [list, setList] = useState<CommissionMyPlayerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [joinedMonth, setJoinedMonth] = useState<Dayjs | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentMyPlayers({
        from: range?.[0]?.toISOString(),
        to: range?.[1]?.toISOString(),
        joinedMonth: joinedMonth ? joinedMonth.format('YYYY-MM') : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setList(data.items);
      setTotal(data.total);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [range, joinedMonth, page, pageSize]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const columns: ColumnsType<CommissionMyPlayerItem> = [
    {
      title: '玩家帳號',
      dataIndex: 'gameAccountMasked',
      width: 140,
      render: (v: string) => <code style={{ fontSize: 13 }}>{v}</code>,
    },
    {
      title: '歸屬時間',
      dataIndex: 'linkedAt',
      width: 170,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '歸屬方式',
      dataIndex: 'linkedSource',
      width: 110,
      render: (v: CommissionMyPlayerItem['linkedSource']) => {
        const cfg = SOURCE_LABEL[v] ?? { text: v, color: 'default' };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '累積儲值',
      dataIndex: 'totalRecharge',
      width: 120,
      align: 'right',
      render: (v: number) => Number(v).toFixed(2),
    },
    {
      title: '我的累積分潤',
      dataIndex: 'totalCommission',
      width: 130,
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <strong style={{ color: '#cf1322' }}>{Number(v).toFixed(2)}</strong>
        ) : (
          <span style={{ color: '#999' }}>0.00</span>
        ),
    },
    {
      title: '交易次數',
      dataIndex: 'transactionCount',
      width: 90,
      align: 'right',
    },
    {
      title: '最後消費',
      dataIndex: 'lastPaidAt',
      width: 170,
      render: (v: string | null) =>
        v ? (
          dayjs(v).format('YYYY-MM-DD HH:mm')
        ) : (
          <span style={{ color: '#999' }}>尚未消費</span>
        ),
    },
  ];

  return (
    <Card title="我的玩家">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="顯示透過你的推廣連結/QR code 註冊、或被歸屬到你（及旗下子代理）名下的所有玩家。"
        description="玩家帳號已遮罩（僅顯示首個英文字母與末位數字）；尚未消費的玩家累積儲值為 0。"
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title={joinedMonth ? `${joinedMonth.format('YYYY-MM')} 加入玩家數` : '玩家總數'}
              value={total}
              suffix="位"
            />
          </Card>
        </Col>
      </Row>
      <Space style={{ marginBottom: 16 }} wrap>
        <DatePicker
          picker="month"
          placeholder="加入月份"
          value={joinedMonth}
          onChange={(v) => {
            setJoinedMonth(v);
            setPage(1);
          }}
        />
        <RangePicker
          showTime
          placeholder={['消費起始', '消費結束']}
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
        scroll={{ x: 'max-content' }}
        rowKey="playerId"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{
          current: page,
          pageSize,
          onChange: setPage,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 位玩家`,
        }}
      />
    </Card>
  );
}
