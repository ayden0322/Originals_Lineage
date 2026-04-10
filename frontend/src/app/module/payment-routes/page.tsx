'use client';

import { useEffect, useState } from 'react';
import { Card, Table, Select, Button, Space, message, Spin, Typography, Tag } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { getPaymentRoutes, updatePaymentRoutes } from '@/lib/api/payment-routes';
import { getPaymentGateways } from '@/lib/api/payment-gateways';
import type { PaymentGateway, PaymentMethod, PaymentRouteItem } from '@/lib/types';

const { Title, Paragraph } = Typography;

const METHOD_LABELS: Record<PaymentMethod, string> = {
  atm: 'ATM 轉帳',
  cvs: '超商代碼',
};

interface RouteRow {
  paymentMethod: PaymentMethod;
  gatewayId: string | null;
}

/**
 * 伺服器金流路由設定頁
 *
 * 一對一映射：每個付款方式只對應一個金流商。
 * 玩家完全不知道背後是哪家金流商，管理者可隨時切換。
 */
export default function PaymentRoutesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [rows, setRows] = useState<RouteRow[]>([]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [routeData, gatewayData] = await Promise.all([
        getPaymentRoutes(),
        getPaymentGateways(),
      ]);
      setRows(routeData);
      setGateways(gatewayData.filter((g) => g.isActive));
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const updateRow = (method: PaymentMethod, gatewayId: string | null) => {
    setRows((prev) =>
      prev.map((r) => (r.paymentMethod === method ? { ...r, gatewayId } : r)),
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const dto = { routes: rows as PaymentRouteItem[] };
      const next = await updatePaymentRoutes(dto);
      setRows(next);
      message.success('已儲存');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const gatewayOptions = [
    { label: '— 無（停用此付款方式）—', value: '__NONE__' },
    ...gateways.map((g) => ({
      label: `${g.displayName}（${g.providerCode}${g.isSandbox ? ' / 測試' : ''}）`,
      value: g.id,
    })),
  ];

  const columns = [
    {
      title: '付款方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 200,
      render: (m: PaymentMethod) => <Tag color="blue">{METHOD_LABELS[m]}</Tag>,
    },
    {
      title: '對應金流商',
      key: 'gatewayId',
      render: (_: unknown, row: RouteRow) => (
        <Select
          style={{ width: 360 }}
          value={row.gatewayId ?? '__NONE__'}
          onChange={(v) =>
            updateRow(row.paymentMethod, v === '__NONE__' ? null : v)
          }
          options={gatewayOptions}
        />
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card>
        <Title level={4}>伺服器金流設定</Title>
        <Paragraph type="secondary">
          設定每個付款方式對應到哪一個金流商。玩家不會看到背後是哪家，管理者可以隨時切換、停用。
          若要新增金流商，請到「模組設定」頁面建立。
        </Paragraph>

        <Table
          rowKey="paymentMethod"
          dataSource={rows}
          columns={columns}
          pagination={false}
          bordered
        />

        <Space style={{ marginTop: 24 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            儲存設定
          </Button>
          <Button onClick={loadAll} disabled={saving}>
            重新載入
          </Button>
        </Space>
      </Card>
    </Spin>
  );
}
