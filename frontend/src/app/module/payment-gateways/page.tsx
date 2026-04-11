'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Switch,
  Button,
  Spin,
  Divider,
  message,
  Table,
  Modal,
  Select,
  InputNumber,
  Tag,
  Space,
  Popconfirm,
  Checkbox,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  getPaymentGateways,
  getAvailableProviders,
  createPaymentGateway,
  updatePaymentGateway,
  deletePaymentGateway,
} from '@/lib/api/payment-gateways';
import type {
  PaymentGateway,
  CreateGatewayDto,
  UpdateGatewayDto,
  ChannelSettings,
  RealNameSettings,
} from '@/lib/types';

const { Title, Paragraph } = Typography;

const PAYMENT_METHODS = [
  { label: 'ATM 轉帳', value: 'atm' },
  { label: '超商代碼', value: 'cvs' },
  { label: '信用卡', value: 'credit_card' },
];

const PROVIDER_LABELS: Record<string, string> = {
  ecpay: '綠界 ECPay',
  smilepay: '速買配 SmilePay',
  antpay: 'AntPay（待補文件）',
  tx2: 'TX2（待補文件）',
  mock: 'Mock (測試用)',
};

const REAL_NAME_FIELDS: Array<{ key: keyof RealNameSettings; label: string }> = [
  { key: 'name', label: '姓名' },
  { key: 'phone', label: '電話' },
  { key: 'email', label: 'Email' },
  { key: 'idNumber', label: '身份證字號' },
  { key: 'bankAccount', label: '匯款帳號' },
  { key: 'address', label: '地址' },
];

const CVS_CHANNELS = [
  { code: '711', displayName: '7-11' },
  { code: 'family', displayName: '全家' },
  { code: 'hilife', displayName: '萊爾富' },
  { code: 'ok', displayName: 'OK' },
];

const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  atm: { enabled: true, displayName: 'ATM', minAmount: 0, maxAmount: 0 },
  cvs: {
    enabled: true,
    channels: CVS_CHANNELS.map((c) => ({
      code: c.code,
      displayName: c.displayName,
      enabled: true,
      minAmount: 0,
      maxAmount: 0,
    })),
  },
  creditCard: { enabled: true, minAmount: 0, maxAmount: 0 },
};

export default function PaymentGatewaysPage() {
  const [loading, setLoading] = useState(true);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [gatewayModalVisible, setGatewayModalVisible] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
  const [gatewayForm] = Form.useForm();
  const [gatewaySubmitting, setGatewaySubmitting] = useState(false);

  const selectedProvider = Form.useWatch('providerCode', gatewayForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gatewayList, providers] = await Promise.all([
        getPaymentGateways(),
        getAvailableProviders(),
      ]);
      setGateways(gatewayList);
      setAvailableProviders(providers);
    } catch {
      message.error('載入金流商失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateGatewayModal = () => {
    setEditingGateway(null);
    gatewayForm.resetFields();
    gatewayForm.setFieldsValue({
      moduleCode: 'originals-lineage',
      isActive: true,
      isSandbox: true,
      priority: 0,
      supportedMethods: ['atm', 'cvs', 'credit_card'],
      productName: '遊戲點數',
      minAmount: 0,
      orderInterval: 0,
      realNameSettings: {},
      channelSettings: DEFAULT_CHANNEL_SETTINGS,
    });
    setGatewayModalVisible(true);
  };

  const openEditGatewayModal = (gw: PaymentGateway) => {
    setEditingGateway(gw);
    const creds = gw.credentials as any;
    const channelSettings: ChannelSettings = {
      atm: gw.channelSettings?.atm ?? DEFAULT_CHANNEL_SETTINGS.atm,
      cvs: gw.channelSettings?.cvs?.channels?.length
        ? gw.channelSettings.cvs
        : DEFAULT_CHANNEL_SETTINGS.cvs,
    };
    gatewayForm.setFieldsValue({
      moduleCode: gw.moduleCode,
      providerCode: gw.providerCode,
      displayName: gw.displayName,
      merchantId: creds?.merchantId || '',
      hashKey: creds?.hashKey || '',
      hashIv: creds?.hashIv || '',
      dcvc: creds?.dcvc || '',
      rvg2c: creds?.rvg2c || '',
      verifyKey: creds?.verifyKey || '',
      supportedMethods: gw.supportedMethods,
      productName: gw.productName ?? '',
      minAmount: gw.minAmount ?? 0,
      orderInterval: gw.orderInterval ?? 0,
      realNameSettings: gw.realNameSettings ?? {},
      channelSettings,
      isActive: gw.isActive,
      isSandbox: gw.isSandbox,
      priority: gw.priority,
    });
    setGatewayModalVisible(true);
  };

  const handleGatewaySave = async () => {
    try {
      const values = await gatewayForm.validateFields();
      setGatewaySubmitting(true);

      const provider = editingGateway?.providerCode || values.providerCode;
      let credentials: Record<string, unknown>;
      if (provider === 'smilepay') {
        credentials = {
          dcvc: values.dcvc,
          rvg2c: values.rvg2c,
          verifyKey: values.verifyKey,
        };
      } else {
        credentials = {
          merchantId: values.merchantId,
          hashKey: values.hashKey,
          hashIv: values.hashIv,
        };
      }

      const sharedFields = {
        productName: values.productName ?? '',
        minAmount: values.minAmount ?? 0,
        orderInterval: values.orderInterval ?? 0,
        realNameSettings: values.realNameSettings ?? {},
        channelSettings: values.channelSettings ?? DEFAULT_CHANNEL_SETTINGS,
        vendorType: provider as CreateGatewayDto['vendorType'],
      };

      if (editingGateway) {
        const dto: UpdateGatewayDto = {
          displayName: values.displayName,
          credentials,
          supportedMethods: values.supportedMethods,
          isActive: values.isActive,
          isSandbox: values.isSandbox,
          priority: values.priority,
          ...sharedFields,
        };
        await updatePaymentGateway(editingGateway.id, dto);
        message.success('金流商更新成功');
      } else {
        const dto: CreateGatewayDto = {
          moduleCode: values.moduleCode || 'originals-lineage',
          providerCode: values.providerCode,
          displayName: values.displayName,
          credentials,
          supportedMethods: values.supportedMethods,
          isActive: values.isActive ?? true,
          isSandbox: values.isSandbox ?? true,
          priority: values.priority ?? 0,
          ...sharedFields,
        };
        await createPaymentGateway(dto);
        message.success('金流商新增成功');
      }

      setGatewayModalVisible(false);
      await fetchData();
    } catch {
      message.error('操作失敗');
    } finally {
      setGatewaySubmitting(false);
    }
  };

  const handleDeleteGateway = async (id: string) => {
    try {
      await deletePaymentGateway(id);
      message.success('金流商已刪除');
      await fetchData();
    } catch {
      message.error('刪除失敗');
    }
  };

  const gatewayColumns = [
    {
      title: '供應商',
      dataIndex: 'providerCode',
      key: 'providerCode',
      render: (code: string) => (
        <Tag
          color={
            code === 'ecpay'
              ? 'green'
              : code === 'smilepay'
              ? 'cyan'
              : code === 'mock'
              ? 'default'
              : 'blue'
          }
        >
          {PROVIDER_LABELS[code] || code}
        </Tag>
      ),
    },
    { title: '顯示名稱', dataIndex: 'displayName', key: 'displayName' },
    {
      title: '商店代號',
      key: 'merchantId',
      render: (_: unknown, record: PaymentGateway) =>
        record.providerCode === 'smilepay'
          ? (record.credentials as any)?.dcvc || '-'
          : (record.credentials as any)?.merchantId || '-',
    },
    {
      title: '付款方式',
      dataIndex: 'supportedMethods',
      key: 'supportedMethods',
      render: (methods: string[]) =>
        methods?.map((m) => {
          const label = PAYMENT_METHODS.find((p) => p.value === m)?.label || m;
          return <Tag key={m}>{label}</Tag>;
        }),
    },
    {
      title: '狀態',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) =>
        active ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            啟用
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">
            停用
          </Tag>
        ),
    },
    {
      title: '模式',
      dataIndex: 'isSandbox',
      key: 'isSandbox',
      render: (sandbox: boolean) =>
        sandbox ? <Tag color="orange">測試</Tag> : <Tag color="green">正式</Tag>,
    },
    { title: '優先度', dataIndex: 'priority', key: 'priority' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: PaymentGateway) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditGatewayModal(record)}
          >
            編輯
          </Button>
          <Popconfirm
            title="確定要刪除此金流商嗎？"
            onConfirm={() => handleDeleteGateway(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>
              金流商管理
            </Title>
            <Paragraph type="secondary" style={{ margin: '4px 0 0 0' }}>
              建立各家金流商帳號設定（憑證、商品名稱、實名制、通道限額）。建立完後到「伺服器金流設定」決定每個付款方式對應到哪家。
            </Paragraph>
          </div>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateGatewayModal}
          >
            新增金流商
          </Button>
        }
      >
        <Table
          columns={gatewayColumns}
          dataSource={gateways}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '尚未設定任何金流商' }}
        />
      </Card>

      {/* ─── 金流商新增/編輯 Modal ────────────────────── */}
      <Modal
        title={editingGateway ? '編輯金流商' : '新增金流商'}
        open={gatewayModalVisible}
        onOk={handleGatewaySave}
        onCancel={() => setGatewayModalVisible(false)}
        confirmLoading={gatewaySubmitting}
        okText="儲存"
        cancelText="取消"
        width={680}
      >
        <Form form={gatewayForm} layout="vertical">
          <Form.Item name="moduleCode" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            name="providerCode"
            label="金流供應商"
            rules={[{ required: true, message: '請選擇供應商' }]}
          >
            <Select
              disabled={!!editingGateway}
              placeholder="選擇金流供應商"
              options={availableProviders.map((p) => ({
                label: PROVIDER_LABELS[p] || p,
                value: p,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="displayName"
            label="顯示名稱"
            rules={[{ required: true, message: '請輸入顯示名稱' }]}
          >
            <Input placeholder="例如：綠界主商家" />
          </Form.Item>

          {/* ECPay 憑證欄位 */}
          {(!selectedProvider || selectedProvider === 'ecpay') && (
            <>
              <Form.Item name="merchantId" label="商店代號 (Merchant ID)">
                <Input placeholder="例如：3002607" />
              </Form.Item>
              <Form.Item name="hashKey" label="Hash Key">
                <Input.Password placeholder="金流 Hash Key" />
              </Form.Item>
              <Form.Item name="hashIv" label="Hash IV">
                <Input.Password placeholder="金流 Hash IV" />
              </Form.Item>
            </>
          )}

          {/* SmilePay 憑證欄位 */}
          {selectedProvider === 'smilepay' && (
            <>
              <Form.Item name="dcvc" label="商家代號 (Dcvc)">
                <Input placeholder="SmilePay 商家代號" />
              </Form.Item>
              <Form.Item name="rvg2c" label="參數代碼 (Rvg2c)">
                <Input.Password placeholder="SmilePay 參數代碼" />
              </Form.Item>
              <Form.Item name="verifyKey" label="驗證金鑰 (Verify Key)">
                <Input.Password placeholder="SmilePay 驗證金鑰" />
              </Form.Item>
            </>
          )}

          <Form.Item name="supportedMethods" label="支援付款方式">
            <Checkbox.Group options={PAYMENT_METHODS} />
          </Form.Item>

          <Divider orientation="left" plain>
            金流商基本設定
          </Divider>

          <Form.Item name="productName" label="商品名稱（顯示在金流商收銀台）">
            <Input placeholder="例如：遊戲點數" />
          </Form.Item>

          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="minAmount" label="單筆最小金額（0=不限）">
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="orderInterval" label="開單間隔（分鐘，0=不限）">
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
          </Space>

          <Divider orientation="left" plain>
            實名制欄位（玩家結帳必填）
          </Divider>
          <Space wrap>
            {REAL_NAME_FIELDS.map((f) => (
              <Form.Item
                key={f.key}
                name={['realNameSettings', f.key]}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>{f.label}</Checkbox>
              </Form.Item>
            ))}
          </Space>

          <Divider orientation="left" plain>
            ATM 通道
          </Divider>
          <Space align="start" wrap>
            <Form.Item
              name={['channelSettings', 'atm', 'enabled']}
              valuePropName="checked"
              label="啟用"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name={['channelSettings', 'atm', 'minAmount']}
              label="最小金額"
            >
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item
              name={['channelSettings', 'atm', 'maxAmount']}
              label="最大金額（0=不限）"
            >
              <InputNumber min={0} />
            </Form.Item>
          </Space>

          <Divider orientation="left" plain>
            超商通道
          </Divider>
          <Form.Item
            name={['channelSettings', 'cvs', 'enabled']}
            valuePropName="checked"
            label="超商總開關"
          >
            <Switch />
          </Form.Item>
          {CVS_CHANNELS.map((c, idx) => (
            <Space
              key={c.code}
              align="start"
              wrap
              style={{ marginBottom: 8 }}
            >
              <Form.Item
                name={['channelSettings', 'cvs', 'channels', idx, 'code']}
                hidden
                initialValue={c.code}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name={[
                  'channelSettings',
                  'cvs',
                  'channels',
                  idx,
                  'displayName',
                ]}
                hidden
                initialValue={c.displayName}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name={['channelSettings', 'cvs', 'channels', idx, 'enabled']}
                valuePropName="checked"
                label={c.displayName}
              >
                <Switch />
              </Form.Item>
              <Form.Item
                name={['channelSettings', 'cvs', 'channels', idx, 'minAmount']}
                label="最小"
              >
                <InputNumber min={0} style={{ width: 100 }} />
              </Form.Item>
              <Form.Item
                name={['channelSettings', 'cvs', 'channels', idx, 'maxAmount']}
                label="最大"
              >
                <InputNumber min={0} style={{ width: 100 }} />
              </Form.Item>
            </Space>
          ))}

          <Divider orientation="left" plain>
            信用卡
          </Divider>
          <Space align="start" wrap>
            <Form.Item
              name={['channelSettings', 'creditCard', 'enabled']}
              valuePropName="checked"
              label="啟用"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name={['channelSettings', 'creditCard', 'minAmount']}
              label="最小金額（0=不限）"
            >
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item
              name={['channelSettings', 'creditCard', 'maxAmount']}
              label="最大金額（0=不限）"
            >
              <InputNumber min={0} />
            </Form.Item>
          </Space>

          <Divider orientation="left" plain>
            狀態
          </Divider>

          <Form.Item name="isSandbox" label="測試模式" valuePropName="checked">
            <Switch checkedChildren="測試" unCheckedChildren="正式" />
          </Form.Item>

          <Form.Item name="isActive" label="啟用狀態" valuePropName="checked">
            <Switch checkedChildren="啟用" unCheckedChildren="停用" />
          </Form.Item>

          <Form.Item name="priority" label="優先順序（數字越大越優先）">
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  );
}
