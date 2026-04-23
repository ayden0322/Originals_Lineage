'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Input,
  Form,
  message,
  Switch,
  Tooltip,
  Typography,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  CopyOutlined,
  QrcodeOutlined,
  DownloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  agentMyLinks,
  agentMyPlayers,
  agentCreateMyLink,
  agentToggleMyLink,
} from '@/lib/api/commission';
import type { CommissionReferralLink } from '@/lib/types';

export default function AgentLinksPage() {
  const [list, setList] = useState<CommissionReferralLink[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [qrTarget, setQrTarget] = useState<CommissionReferralLink | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // 連結清單與玩家總數同時載入（僅取 total，故 limit=1）
      const [links, players] = await Promise.all([
        agentMyLinks(),
        agentMyPlayers({ limit: 1 }),
      ]);
      setList(links);
      setTotalPlayers(players.total);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const buildUrl = (code: string) => {
    if (typeof window === 'undefined') return '';
    // 帶 ?to=/auth/register，讓玩家點完連結直接進註冊頁（省去自行找註冊入口的步驟）
    return `${window.location.origin}/api/public/originals/ref/${code}?to=/auth/register`;
  };

  // 用免費的 goqr.me API 產 QR Code（無需安裝套件）
  const buildQrUrl = (code: string, size = 320) => {
    const target = encodeURIComponent(buildUrl(code));
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${target}`;
  };

  const copyLink = (code: string) => {
    const url = buildUrl(code);
    navigator.clipboard.writeText(url);
    message.success('已複製連結');
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await agentCreateMyLink(label.trim() || undefined);
      message.success('已建立連結');
      setCreateOpen(false);
      setLabel('');
      fetch();
    } catch {
      message.error('建立失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await agentToggleMyLink(id, active);
      fetch();
    } catch {
      message.error('更新失敗');
    }
  };

  const downloadQr = async () => {
    if (!qrTarget) return;
    try {
      const res = await window.fetch(buildQrUrl(qrTarget.code, 600));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr_${qrTarget.code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('下載失敗，請改右鍵儲存圖片');
    }
  };

  const columns: ColumnsType<CommissionReferralLink> = [
    {
      title: '連結代碼',
      dataIndex: 'code',
      width: 120,
      render: (v: string) => <strong>{v}</strong>,
    },
    { title: '標籤', dataIndex: 'label', render: (v: string | null) => v || '-' },
    {
      title: '完整網址',
      key: 'url',
      render: (_, r) => (
        <Typography.Text copyable={{ text: buildUrl(r.code) }} ellipsis>
          {buildUrl(r.code)}
        </Typography.Text>
      ),
    },
    {
      title: '啟用',
      dataIndex: 'active',
      width: 100,
      render: (v: boolean, r) => (
        <Switch checked={v} onChange={(c) => handleToggle(r.id, c)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, r) => (
        <Space>
          <Tooltip title="複製連結">
            <Button size="small" icon={<CopyOutlined />} onClick={() => copyLink(r.code)}>
              複製
            </Button>
          </Tooltip>
          <Button size="small" icon={<QrcodeOutlined />} onClick={() => setQrTarget(r)}>
            QR Code
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="推廣連結"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          新增連結
        </Button>
      }
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="累積推廣玩家數"
              value={totalPlayers}
              prefix={<TeamOutlined />}
              suffix="位"
            />
          </Card>
        </Col>
      </Row>
      <Table
        scroll={{ x: 'max-content' }}
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={false}
      />

      <Modal
        title="新增推廣連結"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
      >
        <Form layout="vertical">
          <Form.Item label="標籤（選填，幫自己分辨用）">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：FB 廣告 / LINE 群"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`QR Code - ${qrTarget?.code}`}
        open={!!qrTarget}
        onCancel={() => setQrTarget(null)}
        footer={[
          <Button
            key="dl"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={downloadQr}
          >
            下載 PNG
          </Button>,
        ]}
      >
        {qrTarget && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildQrUrl(qrTarget.code, 320)}
              alt={`QR Code for ${qrTarget.code}`}
              style={{ width: 320, height: 320 }}
            />
            <div style={{ marginTop: 12, fontSize: 12, color: '#888', wordBreak: 'break-all' }}>
              {buildUrl(qrTarget.code)}
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
