'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Select,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Descriptions,
  Form,
  InputNumber,
  Input,
  message,
  Popconfirm,
  Empty,
  Tabs,
  Statistic,
  Row,
  Col,
  Alert,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  DollarOutlined,
  PlusOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  getAgentTree,
  listSettlements,
  getSettlementDetail,
  addAdjustment,
  confirmSettlement,
  markSettlementPaid,
  getUnsettledPreview,
} from '@/lib/api/commission';
import type {
  CommissionAgentTreeNode,
  CommissionSettlement,
  CommissionSettlementDetail,
  CommissionUnsettledPreview,
  CommissionUnsettledPreviewItem,
} from '@/lib/types';

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待確認', color: 'gold' },
  settled: { label: '已確認', color: 'blue' },
  paid: { label: '已出款', color: 'green' },
};

export default function CommissionSettlementsPage() {
  const [agents, setAgents] = useState<CommissionAgentTreeNode[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [list, setList] = useState<CommissionSettlement[]>([]);
  const [loading, setLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<CommissionSettlementDetail | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjAmount, setAdjAmount] = useState<number | null>(null);
  const [adjReason, setAdjReason] = useState('');
  const [adjType, setAdjType] = useState<'manual' | 'bonus'>('manual');
  const [submitting, setSubmitting] = useState(false);

  // 當期預估
  const [preview, setPreview] = useState<CommissionUnsettledPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchAgents = useCallback(async () => {
    const tree = await getAgentTree();
    setAgents(tree);
  }, []);

  const fetchList = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const data = await listSettlements(agentId);
      setList(data);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const data = await getUnsettledPreview();
      setPreview(data);
    } catch {
      message.error('載入當期預估失敗');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchPreview();
  }, [fetchAgents, fetchPreview]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const flat = agents.flatMap((a) => [a, ...((a.children as CommissionAgentTreeNode[]) ?? [])]);

  const openDetail = async (s: CommissionSettlement) => {
    try {
      const d = await getSettlementDetail(s.id);
      setDetail(d);
      setDetailOpen(true);
    } catch {
      message.error('載入詳情失敗');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await confirmSettlement(id);
      message.success('已確認');
      fetchList();
    } catch {
      message.error('確認失敗');
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await markSettlementPaid(id);
      message.success('已標記出款');
      fetchList();
    } catch {
      message.error('標記失敗');
    }
  };

  const handleAdjust = async () => {
    if (!detail || adjAmount === null || !adjReason.trim()) {
      message.error('請填寫金額與原因');
      return;
    }
    try {
      setSubmitting(true);
      await addAdjustment(detail.settlement.id, adjAmount, adjReason.trim(), adjType);
      message.success('已新增加減項');
      setAdjustOpen(false);
      setAdjAmount(null);
      setAdjReason('');
      const d = await getSettlementDetail(detail.settlement.id);
      setDetail(d);
      fetchList();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || '失敗');
    } finally {
      setSubmitting(false);
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
      width: 110,
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
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, row) => (
        <Space size="small" wrap>
          <Button size="small" onClick={() => openDetail(row)}>
            詳情
          </Button>
          {row.status === 'pending' && (
            <Popconfirm title="確認結算？確認後才能標記出款" onConfirm={() => handleConfirm(row.id)}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}>
                確認
              </Button>
            </Popconfirm>
          )}
          {row.status === 'settled' && (
            <Popconfirm title="標記為已出款？" onConfirm={() => handleMarkPaid(row.id)}>
              <Button size="small" icon={<DollarOutlined />}>
                標記出款
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const previewColumns: ColumnsType<CommissionUnsettledPreviewItem> = [
    {
      title: '期別',
      dataIndex: 'periodKey',
      width: 110,
      render: (v: string, r) => (
        <Space size={4}>
          <span>{v}</span>
          {r.isCurrentPeriod ? (
            <Tag color="blue">當期</Tag>
          ) : (
            <Tag color="orange">前期殘留</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '代理',
      key: 'agent',
      render: (_, r) => {
        if (r.isSystem) {
          return (
            <Tooltip title="玩家無歸屬（無 ref_code 或上游停權）的交易，不實際分潤">
              <Tag>SYSTEM（無歸屬）</Tag>
            </Tooltip>
          );
        }
        return (
          <Space>
            <strong>{r.agentCode}</strong>
            <span>{r.agentName}</span>
            <Tag color={r.agentLevel === 1 ? 'geekblue' : 'purple'}>
              {r.agentLevel === 1 ? 'A 一級' : 'B 二級'}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: '交易筆數',
      dataIndex: 'transactionCount',
      width: 100,
      align: 'right',
    },
    {
      title: '業績（儲值總額）',
      dataIndex: 'totalBaseAmount',
      width: 150,
      align: 'right',
      render: (v: number) => Number(v).toFixed(2),
    },
    {
      title: '待結分潤',
      dataIndex: 'totalCommission',
      width: 140,
      align: 'right',
      render: (v: number) => <strong>{Number(v).toFixed(2)}</strong>,
    },
  ];

  const renderPreviewTab = () => {
    const nextSettleDate = preview
      ? preview.currentPeriod.periodEnd.slice(0, 10)
      : '-';
    const hasOrphan = preview?.items.some((i) => !i.isCurrentPeriod);
    const hasSystemItems = preview?.items.some((i) => i.isSystem);

    return (
      <>
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message={
            <Space wrap>
              <span>
                結算日：每月 <strong>{preview?.settlementDay ?? '-'}</strong> 號
              </span>
              <span>｜</span>
              <span>
                當期範圍：
                <strong>
                  {preview?.currentPeriod.periodStart.slice(0, 10) ?? '-'} ~{' '}
                  {preview?.currentPeriod.periodEnd.slice(0, 10) ?? '-'}
                </strong>
              </span>
              <span>｜</span>
              <span>
                下次自動結算：<strong>{nextSettleDate}</strong> 00:00
              </span>
            </Space>
          }
          description="此頁面為即時預估，資料來自尚未結算（settlement_id IS NULL）的分潤明細，只讀取不寫入，結算日 00:00 cron 跑完才會進「歷史結算」頁。"
        />

        {hasOrphan && (
          <Alert
            style={{ marginBottom: 16 }}
            type="warning"
            showIcon
            message="偵測到前期殘留：有尚未結算的前期分潤明細"
            description="可能是該期結算日未跑、或先前手動結算時漏掉。建議聯繫技術人員執行補結算。"
          />
        )}

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="涉及代理數"
                value={preview?.summary.totalAgents ?? 0}
                suffix="位"
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="待結交易數"
                value={preview?.summary.totalTransactions ?? 0}
                suffix="筆"
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="業績總額"
                value={preview?.summary.totalBaseAmount ?? 0}
                precision={2}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="待結分潤總額"
                value={preview?.summary.totalCommission ?? 0}
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>

        <Space style={{ marginBottom: 12 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchPreview} loading={previewLoading}>
            重新整理
          </Button>
          {hasSystemItems && (
            <Tooltip title="SYSTEM 是無歸屬玩家的累計，分潤為 0，純粹用來報表閉環">
              <span style={{ color: '#999' }}>
                <InfoCircleOutlined /> 列表含 SYSTEM（無歸屬）
              </span>
            </Tooltip>
          )}
        </Space>

        <Table
          scroll={{ x: 'max-content' }}
          rowKey={(r) => `${r.periodKey}-${r.agentId}`}
          loading={previewLoading}
          columns={previewColumns}
          dataSource={preview?.items ?? []}
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: (
              <Empty description="目前沒有待結算的分潤紀錄" />
            ),
          }}
        />
      </>
    );
  };

  const renderHistoryTab = () => (
    <>
      <Space style={{ marginBottom: 16 }}>
        <span>選擇代理：</span>
        <Select
          showSearch
          style={{ width: 320 }}
          placeholder="選擇代理"
          optionFilterProp="label"
          value={agentId}
          onChange={setAgentId}
          options={flat
            .filter((a) => !a.isSystem)
            .map((a) => ({
              label: `${a.code} - ${a.name}（${a.parentId ? 'B' : 'A'}）`,
              value: a.id,
            }))}
        />
      </Space>
      {agentId ? (
        <Table
          scroll={{ x: 'max-content' }}
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={list}
          pagination={{ pageSize: 12 }}
        />
      ) : (
        <Empty description="請先選擇代理" />
      )}
    </>
  );

  return (
    <Card title="結算管理">
      <Tabs
        defaultActiveKey="preview"
        items={[
          {
            key: 'preview',
            label: '當期預估',
            children: renderPreviewTab(),
          },
          {
            key: 'history',
            label: '歷史結算',
            children: renderHistoryTab(),
          },
        ]}
      />

      <Modal
        title={detail ? `結算詳情 - ${detail.settlement.periodKey}` : '結算詳情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <Space>
            <Button
              icon={<PlusOutlined />}
              disabled={detail?.settlement.status === 'paid'}
              onClick={() => setAdjustOpen(true)}
            >
              新增加減項
            </Button>
            <Button onClick={() => setDetailOpen(false)}>關閉</Button>
          </Space>
        }
        width={800}
      >
        {detail && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
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
                <strong>{Number(detail.settlement.finalAmount).toFixed(2)}</strong>
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
                { title: '時間', dataIndex: 'createdAt', width: 180, render: (v: string) => v.slice(0, 19).replace('T', ' ') },
                { title: '類型', dataIndex: 'sourceType', width: 80 },
                { title: '金額', dataIndex: 'amount', width: 100, render: (v: number) => Number(v).toFixed(2) },
                { title: '原因', dataIndex: 'reason' },
              ]}
              locale={{ emptyText: '無加減項' }}
            />
            <h4 style={{ marginTop: 16 }}>分潤紀錄（{detail.records.length} 筆）</h4>
            <Table
              scroll={{ x: 'max-content' }}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5 }}
              dataSource={detail.records}
              columns={[
                { title: '交易', dataIndex: 'transactionId', ellipsis: true },
                { title: '基準', dataIndex: 'baseAmount', width: 80, render: (v: number) => Number(v).toFixed(2) },
                { title: '比例', dataIndex: 'rateSnapshot', width: 80, render: (v: number) => `${(Number(v) * 100).toFixed(2)}%` },
                { title: '分潤', dataIndex: 'commissionAmount', width: 90, render: (v: number) => Number(v).toFixed(2) },
                { title: '時間', dataIndex: 'paidAt', width: 160, render: (v: string) => v.slice(0, 19).replace('T', ' ') },
              ]}
            />
          </>
        )}
      </Modal>

      <Modal
        title="新增加減項"
        open={adjustOpen}
        onCancel={() => setAdjustOpen(false)}
        onOk={handleAdjust}
        confirmLoading={submitting}
      >
        <Form layout="vertical">
          <Form.Item label="類型">
            <Select
              value={adjType}
              onChange={(v) => setAdjType(v)}
              options={[
                { label: '手動調整', value: 'manual' },
                { label: '補發獎金', value: 'bonus' },
              ]}
            />
          </Form.Item>
          <Form.Item label="金額" required extra="正數=加項，負數=減項">
            <InputNumber
              style={{ width: '100%' }}
              value={adjAmount}
              onChange={(v) => setAdjAmount(v as number)}
            />
          </Form.Item>
          <Form.Item label="原因" required>
            <Input.TextArea rows={3} value={adjReason} onChange={(e) => setAdjReason(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
