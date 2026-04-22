'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  Table,
  DatePicker,
  Statistic,
  Row,
  Col,
  Tooltip,
  message,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  getPlayerAttribution,
  listPlayerTransactions,
} from '@/lib/api/commission';
import type {
  CommissionPlayerAttribution,
  CommissionPlayerTransactionsResult,
} from '@/lib/types';

const { RangePicker } = DatePicker;

const sourceLabel: Record<string, { text: string; color: string }> = {
  cookie: { text: 'Cookie 綁定', color: 'blue' },
  register: { text: '註冊時帶入', color: 'green' },
  manual: { text: '管理者手動', color: 'orange' },
  system: { text: '無歸屬', color: 'default' },
};

type QuickRange = 'thisMonth' | 'lastMonth' | 'last30d' | 'all';

function resolveRange(key: QuickRange): [Dayjs, Dayjs] | null {
  const now = dayjs();
  switch (key) {
    case 'thisMonth':
      return [now.startOf('month'), now.endOf('month')];
    case 'lastMonth': {
      const lm = now.subtract(1, 'month');
      return [lm.startOf('month'), lm.endOf('month')];
    }
    case 'last30d':
      return [now.subtract(30, 'day').startOf('day'), now.endOf('day')];
    case 'all':
      return null;
  }
}

export default function CommissionPlayerDetailPage() {
  const router = useRouter();
  const params = useParams<{ playerId: string }>();
  const playerId = params?.playerId as string;

  const [attr, setAttr] = useState<CommissionPlayerAttribution | null>(null);
  const [attrLoading, setAttrLoading] = useState(true);

  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(
    resolveRange('thisMonth'),
  );
  const [quick, setQuick] = useState<QuickRange>('thisMonth');

  const [data, setData] = useState<CommissionPlayerTransactionsResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    setAttrLoading(true);
    getPlayerAttribution(playerId)
      .then(setAttr)
      .catch(() => message.error('載入玩家資料失敗'))
      .finally(() => setAttrLoading(false));
  }, [playerId]);

  const fetchTxs = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const result = await listPlayerTransactions(playerId, {
        from: range?.[0]?.toISOString(),
        to: range?.[1]?.toISOString(),
        limit: 500,
      });
      setData(result);
    } catch {
      message.error('載入交易紀錄失敗');
    } finally {
      setLoading(false);
    }
  }, [playerId, range]);

  useEffect(() => {
    fetchTxs();
  }, [fetchTxs]);

  const applyQuick = (q: QuickRange) => {
    setQuick(q);
    setRange(resolveRange(q));
  };

  const columns: ColumnsType<
    NonNullable<typeof data>['items'][number]
  > = useMemo(
    () => [
      {
        title: '交易時間',
        dataIndex: 'paidAt',
        width: 170,
        render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '儲值金額',
        dataIndex: 'baseAmount',
        width: 120,
        align: 'right',
        render: (v: number, row) => (
          <strong
            style={{
              color: row.refunded ? '#999' : undefined,
              textDecoration: row.refunded ? 'line-through' : undefined,
            }}
          >
            {Number(v).toFixed(2)}
          </strong>
        ),
      },
      {
        title: (
          <Tooltip title="一級代理（A）分潤">
            <span>A 代理分潤</span>
          </Tooltip>
        ),
        width: 180,
        render: (_: unknown, row) => {
          if (!row.aCode) return <span style={{ color: '#bbb' }}>-</span>;
          return (
            <Space direction="vertical" size={0}>
              <Space size={4}>
                <Tag color="gold">A</Tag>
                <strong>{row.aCode}</strong>
              </Space>
              <span style={{ fontSize: 12 }}>
                抽成 {((row.aRate ?? 0) * 100).toFixed(2)}% ={' '}
                <span style={{ color: '#cf1322' }}>
                  {row.aCommission.toFixed(2)}
                </span>
              </span>
            </Space>
          );
        },
      },
      {
        title: (
          <Tooltip title="二級代理（B）分潤">
            <span>B 代理分潤</span>
          </Tooltip>
        ),
        width: 180,
        render: (_: unknown, row) => {
          if (!row.bCode) return <span style={{ color: '#bbb' }}>-</span>;
          return (
            <Space direction="vertical" size={0}>
              <Space size={4}>
                <Tag color="cyan">B</Tag>
                <strong>{row.bCode}</strong>
              </Space>
              <span style={{ fontSize: 12 }}>
                抽成 {((row.bRate ?? 0) * 100).toFixed(2)}% ={' '}
                <span style={{ color: '#cf1322' }}>
                  {row.bCommission.toFixed(2)}
                </span>
              </span>
            </Space>
          );
        },
      },
      {
        title: '結算週期',
        dataIndex: 'periodKey',
        width: 110,
        render: (v: string) => <Tag>{v}</Tag>,
      },
      {
        title: '狀態',
        width: 140,
        render: (_: unknown, row) => (
          <Space size={4}>
            {row.refunded && <Tag color="red">已退款</Tag>}
            {row.settled ? (
              <Tag color="green">已結算</Tag>
            ) : (
              <Tag color="default">未結算</Tag>
            )}
          </Space>
        ),
      },
      {
        title: 'Transaction ID',
        dataIndex: 'transactionId',
        width: 200,
        render: (v: string) => (
          <Tooltip title={v}>
            <code style={{ fontSize: 11, color: '#999' }}>
              {v.length > 20 ? `${v.slice(0, 20)}…` : v}
            </code>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  const summary = data?.summary;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push('/module/commission/players')}
            >
              返回列表
            </Button>
            <span>玩家明細</span>
          </Space>
        }
        loading={attrLoading}
      >
        {attr ? (
          <Descriptions
            column={{ xs: 1, sm: 2, md: 3 }}
            size="small"
            bordered
          >
            <Descriptions.Item label="玩家 ID" span={3}>
              <code>{attr.playerId}</code>
            </Descriptions.Item>
            <Descriptions.Item label="遊戲帳號">
              {attr.gameAccountName ?? (
                <span style={{ color: '#999' }}>(無)</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="遊戲角色">
              {attr.charName ? (
                <strong>{attr.charName}</strong>
              ) : (
                <span style={{ color: '#999' }}>未建角</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="所屬血盟">
              {!attr.charName ? (
                <span style={{ color: '#bbb' }}>-</span>
              ) : attr.clanName ? (
                <Tag color="purple">{attr.clanName}</Tag>
              ) : (
                <span style={{ color: '#999' }}>無血盟</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="歸屬代理">
              <code>{attr.agentId}</code>
            </Descriptions.Item>
            <Descriptions.Item label="歸屬方式">
              <Tag>
                {sourceLabel[attr.linkedSource]?.text ?? attr.linkedSource}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="歸屬時間">
              {dayjs(attr.linkedAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
        <Space style={{ marginTop: 16 }}>
          <Button
            icon={<SwapOutlined />}
            onClick={() =>
              router.push(
                `/module/commission/players?tab=single&playerId=${encodeURIComponent(
                  playerId,
                )}`,
              )
            }
          >
            調整歸屬
          </Button>
        </Space>
      </Card>

      <Card
        title="儲值 / 分潤紀錄"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchTxs}>
            重新整理
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="結算週期為日曆月（每月 1 號起算）。淨額 = 原始 - 已退款。"
        />
        <Space wrap style={{ marginBottom: 16 }}>
          <Button.Group>
            <Button
              type={quick === 'thisMonth' ? 'primary' : 'default'}
              onClick={() => applyQuick('thisMonth')}
            >
              本月
            </Button>
            <Button
              type={quick === 'lastMonth' ? 'primary' : 'default'}
              onClick={() => applyQuick('lastMonth')}
            >
              上月
            </Button>
            <Button
              type={quick === 'last30d' ? 'primary' : 'default'}
              onClick={() => applyQuick('last30d')}
            >
              近 30 天
            </Button>
            <Button
              type={quick === 'all' ? 'primary' : 'default'}
              onClick={() => applyQuick('all')}
            >
              全部
            </Button>
          </Button.Group>
          <RangePicker
            value={range ?? undefined}
            onChange={(r) => {
              if (r && r[0] && r[1]) {
                setRange([r[0], r[1]]);
                setQuick('all');
              } else {
                setRange(null);
              }
            }}
            allowClear
          />
        </Space>

        {summary ? (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="交易筆數"
                  value={summary.txCount}
                  suffix={
                    summary.refundedTxCount > 0 ? (
                      <span style={{ fontSize: 13, color: '#cf1322' }}>
                        ／已退 {summary.refundedTxCount}
                      </span>
                    ) : undefined
                  }
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="淨儲值"
                  value={summary.netRecharge}
                  precision={2}
                />
                {summary.refundedRecharge > 0 && (
                  <div style={{ fontSize: 12, color: '#999' }}>
                    原始 {summary.totalRecharge.toFixed(2)} - 退款{' '}
                    {summary.refundedRecharge.toFixed(2)}
                  </div>
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="淨分潤（A + B）"
                  value={summary.netCommission}
                  precision={2}
                  valueStyle={{ color: '#cf1322' }}
                />
                {summary.refundedCommission > 0 && (
                  <div style={{ fontSize: 12, color: '#999' }}>
                    原始 {summary.totalCommission.toFixed(2)} - 退款{' '}
                    {summary.refundedCommission.toFixed(2)}
                  </div>
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="區間"
                  value={
                    range
                      ? `${range[0].format('MM/DD')} ~ ${range[1].format('MM/DD')}`
                      : '全部'
                  }
                />
              </Card>
            </Col>
          </Row>
        ) : null}

        <Table
          rowKey="transactionId"
          loading={loading}
          columns={columns}
          dataSource={data?.items ?? []}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      </Card>
    </Space>
  );
}
