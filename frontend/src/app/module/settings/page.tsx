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
  Radio,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { getSettings, updateLineBotSettings, updateGameDbSettings, testGameDbConnection, updateGameTableMapping, fetchTableColumns } from '@/lib/api/settings';
import {
  getPaymentGateways,
  getAvailableProviders,
  createPaymentGateway,
  updatePaymentGateway,
  deletePaymentGateway,
} from '@/lib/api/payment-gateways';
import type {
  LineBotSettingsDto,
  GameDbSettingsDto,
  PaymentGateway,
  CreateGatewayDto,
  UpdateGatewayDto,
  GameTableMappingDto,
  PasswordEncryption,
} from '@/lib/types';

const PAYMENT_METHODS = [
  { label: '信用卡', value: 'credit_card' },
  { label: 'ATM 轉帳', value: 'atm' },
  { label: '超商代碼', value: 'cvs' },
  { label: '全部', value: 'all' },
];

const PROVIDER_LABELS: Record<string, string> = {
  ecpay: '綠界 ECPay',
  smilepay: '速買配 SmilePay',
  newebpay: '藍新 NewebPay',
  mock: 'Mock (測試用)',
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [lineBotSubmitting, setLineBotSubmitting] = useState(false);
  const [lineBotForm] = Form.useForm<LineBotSettingsDto>();

  // Gateway state
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [gatewayModalVisible, setGatewayModalVisible] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
  const [gatewayForm] = Form.useForm();
  const [gatewaySubmitting, setGatewaySubmitting] = useState(false);

  const selectedProvider = Form.useWatch('providerCode', gatewayForm);

  // Game DB state
  const [gameDbForm] = Form.useForm<GameDbSettingsDto>();
  const [gameDbSubmitting, setGameDbSubmitting] = useState(false);
  const [gameDbTesting, setGameDbTesting] = useState(false);
  const [gameDbConnected, setGameDbConnected] = useState(false);

  // Table mapping state
  const [tableMappingForm] = Form.useForm();
  const [tableMappingSubmitting, setTableMappingSubmitting] = useState(false);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [hasEmailColumn, setHasEmailColumn] = useState(false);
  const [hasStatusColumn, setHasStatusColumn] = useState(false);
  const [tableNameInput, setTableNameInput] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settings, gatewayList, providers] = await Promise.all([
        getSettings(),
        getPaymentGateways(),
        getAvailableProviders(),
      ]);

      const lineBot = settings.lineBot as Record<string, unknown>;
      lineBotForm.setFieldsValue({
        channelId: (lineBot.channelId as string) || '',
        channelSecret: (lineBot.channelSecret as string) || '',
        channelAccessToken: (lineBot.channelAccessToken as string) || '',
      });

      const gameDb = settings.gameDb as Record<string, unknown>;
      gameDbForm.setFieldsValue({
        connectionName: (gameDb.connectionName as string) || '',
        host: (gameDb.host as string) || '',
        port: (gameDb.port as number) || 3306,
        database: (gameDb.database as string) || '',
        username: (gameDb.username as string) || '',
        password: (gameDb.password as string) || '',
      });
      setGameDbConnected(settings.gameDbConnected ?? false);

      // Load table mapping settings
      const mapping = settings.gameTableMapping as GameTableMappingDto | null;
      if (mapping) {
        setTableNameInput(mapping.tableName);
        setHasEmailColumn(mapping.hasEmailColumn);
        setHasStatusColumn(mapping.hasStatusColumn);
        tableMappingForm.setFieldsValue({
          tableName: mapping.tableName,
          username: mapping.columns.username,
          password: mapping.columns.password,
          email: mapping.columns.email || undefined,
          status: mapping.columns.status || undefined,
          passwordEncryption: mapping.passwordEncryption,
        });
        // Auto-fetch columns if table name exists and DB is connected
        if (mapping.tableName && (settings.gameDbConnected ?? false)) {
          try {
            const colResult = await fetchTableColumns(mapping.tableName);
            if (colResult.success) {
              setTableColumns(colResult.columns);
            }
          } catch {
            // silently ignore — columns will be empty
          }
        }
      }

      setGateways(gatewayList);
      setAvailableProviders(providers);
    } catch {
      message.error('載入設定失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineBotForm, gameDbForm, tableMappingForm]);

  const handleLineBotSave = async () => {
    try {
      const values = await lineBotForm.validateFields();
      setLineBotSubmitting(true);
      await updateLineBotSettings(values);
      message.success('LINE Bot 設定儲存成功');
    } catch {
      message.error('LINE Bot 設定儲存失敗');
    } finally {
      setLineBotSubmitting(false);
    }
  };

  const handleGameDbSave = async () => {
    try {
      const values = await gameDbForm.validateFields();
      setGameDbSubmitting(true);
      const result = await updateGameDbSettings(values);
      setGameDbConnected(result.gameDbConnected);
      message.success('遊戲資料庫設定儲存成功');
    } catch {
      message.error('遊戲資料庫設定儲存失敗');
    } finally {
      setGameDbSubmitting(false);
    }
  };

  const handleGameDbTest = async () => {
    try {
      const values = await gameDbForm.validateFields();
      setGameDbTesting(true);
      const result = await testGameDbConnection({
        host: values.host,
        port: values.port,
        database: values.database,
        username: values.username,
        password: values.password,
      });
      if (result.success) {
        message.success('連線測試成功');
      } else {
        message.error(`連線測試失敗: ${result.message}`);
      }
    } catch {
      message.error('連線測試失敗');
    } finally {
      setGameDbTesting(false);
    }
  };

  // ─── Table Mapping ────────────────────────────────────────

  const handleFetchColumns = async () => {
    const name = tableNameInput?.trim();
    if (!name) {
      message.warning('請先輸入資料表名稱');
      return;
    }
    setColumnsLoading(true);
    try {
      const result = await fetchTableColumns(name);
      if (result.success) {
        setTableColumns(result.columns);
        message.success(`讀取到 ${result.columns.length} 個欄位`);
      } else {
        message.error(result.message || '讀取欄位失敗');
        setTableColumns([]);
      }
    } catch {
      message.error('讀取欄位失敗');
      setTableColumns([]);
    } finally {
      setColumnsLoading(false);
    }
  };

  const handleTableMappingSave = async () => {
    try {
      const values = await tableMappingForm.validateFields();
      setTableMappingSubmitting(true);
      const dto: GameTableMappingDto = {
        tableName: tableNameInput,
        columns: {
          username: values.username,
          password: values.password,
          email: hasEmailColumn ? values.email : null,
          status: hasStatusColumn ? values.status : null,
        },
        passwordEncryption: values.passwordEncryption as PasswordEncryption,
        hasEmailColumn,
        hasStatusColumn,
      };
      await updateGameTableMapping(dto);
      message.success('資料表對應設定儲存成功');
    } catch {
      message.error('資料表對應設定儲存失敗');
    } finally {
      setTableMappingSubmitting(false);
    }
  };

  // ─── Gateway CRUD ──────────────────────────────────────────

  const openCreateGatewayModal = () => {
    setEditingGateway(null);
    gatewayForm.resetFields();
    gatewayForm.setFieldsValue({
      moduleCode: 'originals-lineage',
      isActive: true,
      isSandbox: true,
      priority: 0,
      supportedMethods: ['all'],
    });
    setGatewayModalVisible(true);
  };

  const openEditGatewayModal = (gw: PaymentGateway) => {
    setEditingGateway(gw);
    const creds = gw.credentials as any;
    gatewayForm.setFieldsValue({
      moduleCode: gw.moduleCode,
      providerCode: gw.providerCode,
      displayName: gw.displayName,
      // ECPay credentials
      merchantId: creds?.merchantId || '',
      hashKey: creds?.hashKey || '',
      hashIv: creds?.hashIv || '',
      // SmilePay credentials
      dcvc: creds?.dcvc || '',
      rvg2c: creds?.rvg2c || '',
      verifyKey: creds?.verifyKey || '',
      supportedMethods: gw.supportedMethods,
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

      // 依供應商組裝 credentials
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

      if (editingGateway) {
        // 更新
        const dto: UpdateGatewayDto = {
          displayName: values.displayName,
          credentials,
          supportedMethods: values.supportedMethods,
          isActive: values.isActive,
          isSandbox: values.isSandbox,
          priority: values.priority,
        };
        await updatePaymentGateway(editingGateway.id, dto);
        message.success('通道更新成功');
      } else {
        // 新增
        const dto: CreateGatewayDto = {
          moduleCode: values.moduleCode || 'originals-lineage',
          providerCode: values.providerCode,
          displayName: values.displayName,
          credentials,
          supportedMethods: values.supportedMethods,
          isActive: values.isActive ?? true,
          isSandbox: values.isSandbox ?? true,
          priority: values.priority ?? 0,
        };
        await createPaymentGateway(dto);
        message.success('通道新增成功');
      }

      setGatewayModalVisible(false);
      // 重新載入通道列表
      const updatedGateways = await getPaymentGateways();
      setGateways(updatedGateways);
    } catch {
      message.error('操作失敗');
    } finally {
      setGatewaySubmitting(false);
    }
  };

  const handleDeleteGateway = async (id: string) => {
    try {
      await deletePaymentGateway(id);
      message.success('通道已刪除');
      const updatedGateways = await getPaymentGateways();
      setGateways(updatedGateways);
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
        <Tag color={code === 'ecpay' ? 'green' : code === 'smilepay' ? 'cyan' : code === 'mock' ? 'default' : 'blue'}>
          {PROVIDER_LABELS[code] || code}
        </Tag>
      ),
    },
    {
      title: '顯示名稱',
      dataIndex: 'displayName',
      key: 'displayName',
    },
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
        sandbox ? (
          <Tag color="orange">測試</Tag>
        ) : (
          <Tag color="green">正式</Tag>
        ),
    },
    {
      title: '優先度',
      dataIndex: 'priority',
      key: 'priority',
    },
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
            title="確定要刪除此通道嗎？"
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
    <div>
      <h2>模組設定</h2>
      <Spin spinning={loading}>
        {/* ─── 支付通道管理 ───────────────────────────── */}
        <Card
          title="支付通道管理"
          style={{ marginTop: 16 }}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateGatewayModal}
            >
              新增通道
            </Button>
          }
        >
          <Table
            columns={gatewayColumns}
            dataSource={gateways}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: '尚未設定任何支付通道' }}
          />
        </Card>

        <Divider />

        {/* ─── LINE Bot 設定 ──────────────────────────── */}
        <Card title="LINE Bot 設定">
          <Form form={lineBotForm} layout="vertical">
            <Form.Item name="channelId" label="Channel ID">
              <Input />
            </Form.Item>
            <Form.Item name="channelSecret" label="Channel Secret">
              <Input.Password />
            </Form.Item>
            <Form.Item name="channelAccessToken" label="Channel Access Token">
              <Input.Password />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                loading={lineBotSubmitting}
                onClick={handleLineBotSave}
              >
                儲存 LINE Bot 設定
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Divider />

        {/* ─── 遊戲資料庫設定 ──────────────────────────── */}
        <Card
          title="遊戲資料庫設定"
          extra={
            gameDbConnected ? (
              <Tag icon={<CheckCircleOutlined />} color="success">已連線</Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="error">未連線</Tag>
            )
          }
        >
          <Form form={gameDbForm} layout="vertical">
            <Form.Item
              name="connectionName"
              label="連線名稱"
              rules={[{ required: true, message: '請輸入連線名稱' }]}
            >
              <Input placeholder="例如：主要遊戲資料庫" />
            </Form.Item>

            <Form.Item
              name="host"
              label="資料庫IP"
              rules={[{ required: true, message: '請輸入資料庫IP' }]}
            >
              <Input placeholder="例如：127.0.0.1" />
            </Form.Item>

            <Form.Item name="port" label="資料庫PORT">
              <InputNumber
                min={1}
                max={65535}
                placeholder="3306"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="database"
              label="資料庫名稱"
              rules={[{ required: true, message: '請輸入資料庫名稱' }]}
            >
              <Input placeholder="例如：lineage_db" />
            </Form.Item>

            <Form.Item
              name="username"
              label="DB使用者"
              rules={[{ required: true, message: '請輸入使用者名稱' }]}
            >
              <Input placeholder="例如：root" />
            </Form.Item>

            <Form.Item
              name="password"
              label="DB使用者密碼"
              rules={[{ required: true, message: '請輸入密碼' }]}
            >
              <Input.Password placeholder="資料庫密碼" />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  loading={gameDbSubmitting}
                  onClick={handleGameDbSave}
                >
                  儲存遊戲資料庫設定
                </Button>
                <Button
                  loading={gameDbTesting}
                  onClick={handleGameDbTest}
                >
                  連線測試
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <Divider />

        {/* ─── 帳號資料表對應 ─────────────────────────── */}
        <Card
          title="帳號資料表對應"
          extra={
            gameDbConnected ? (
              <Tag icon={<CheckCircleOutlined />} color="success">已連線</Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="error">未連線</Tag>
            )
          }
        >
          {!gameDbConnected ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <DatabaseOutlined style={{ fontSize: 32, marginBottom: 8 }} />
              <p>請先在上方設定遊戲資料庫連線，才能配置資料表對應</p>
            </div>
          ) : (
            <Form form={tableMappingForm} layout="vertical">
              {/* 資料表名稱 + 讀取欄位按鈕 */}
              <Form.Item label="資料表名稱" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    value={tableNameInput}
                    onChange={(e) => setTableNameInput(e.target.value)}
                    placeholder="例如：accounts"
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="primary"
                    loading={columnsLoading}
                    onClick={handleFetchColumns}
                    icon={<DatabaseOutlined />}
                  >
                    讀取欄位
                  </Button>
                </Space.Compact>
              </Form.Item>

              {tableColumns.length > 0 && (
                <>
                  <Form.Item
                    name="username"
                    label="帳號欄位"
                    rules={[{ required: true, message: '請選擇帳號欄位' }]}
                  >
                    <Select placeholder="選擇對應帳號的欄位">
                      {tableColumns.map((col) => (
                        <Select.Option key={col} value={col}>{col}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="密碼欄位"
                    rules={[{ required: true, message: '請選擇密碼欄位' }]}
                  >
                    <Select placeholder="選擇對應密碼的欄位">
                      {tableColumns.map((col) => (
                        <Select.Option key={col} value={col}>{col}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item label="Email 欄位">
                    <Space>
                      <Form.Item
                        name="email"
                        noStyle
                        rules={hasEmailColumn ? [{ required: true, message: '請選擇 Email 欄位' }] : []}
                      >
                        <Select
                          placeholder="選擇 Email 欄位"
                          disabled={!hasEmailColumn}
                          style={{ width: 200 }}
                          allowClear
                        >
                          {tableColumns.map((col) => (
                            <Select.Option key={col} value={col}>{col}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Checkbox
                        checked={!hasEmailColumn}
                        onChange={(e) => {
                          setHasEmailColumn(!e.target.checked);
                          if (e.target.checked) {
                            tableMappingForm.setFieldsValue({ email: undefined });
                          }
                        }}
                      >
                        無此欄位
                      </Checkbox>
                    </Space>
                  </Form.Item>

                  <Form.Item label="狀態欄位">
                    <Space>
                      <Form.Item
                        name="status"
                        noStyle
                        rules={hasStatusColumn ? [{ required: true, message: '請選擇狀態欄位' }] : []}
                      >
                        <Select
                          placeholder="選擇狀態欄位"
                          disabled={!hasStatusColumn}
                          style={{ width: 200 }}
                          allowClear
                        >
                          {tableColumns.map((col) => (
                            <Select.Option key={col} value={col}>{col}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Checkbox
                        checked={!hasStatusColumn}
                        onChange={(e) => {
                          setHasStatusColumn(!e.target.checked);
                          if (e.target.checked) {
                            tableMappingForm.setFieldsValue({ status: undefined });
                          }
                        }}
                      >
                        無此欄位
                      </Checkbox>
                    </Space>
                  </Form.Item>

                  <Form.Item
                    name="passwordEncryption"
                    label="密碼加密方式"
                    rules={[{ required: true, message: '請選擇密碼加密方式' }]}
                    initialValue="plaintext"
                  >
                    <Radio.Group>
                      <Radio value="plaintext">明文</Radio>
                      <Radio value="md5">MD5</Radio>
                      <Radio value="sha1">SHA1</Radio>
                      <Radio value="sha256">SHA256</Radio>
                      <Radio value="bcrypt">bcrypt</Radio>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      loading={tableMappingSubmitting}
                      onClick={handleTableMappingSave}
                    >
                      儲存資料表對應設定
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form>
          )}
        </Card>
      </Spin>

      {/* ─── 通道新增/編輯 Modal ────────────────────── */}
      <Modal
        title={editingGateway ? '編輯支付通道' : '新增支付通道'}
        open={gatewayModalVisible}
        onOk={handleGatewaySave}
        onCancel={() => setGatewayModalVisible(false)}
        confirmLoading={gatewaySubmitting}
        okText="儲存"
        cancelText="取消"
        width={600}
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
            <Input placeholder="例如：綠界信用卡" />
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

          <Form.Item
            name="isSandbox"
            label="測試模式"
            valuePropName="checked"
          >
            <Switch checkedChildren="測試" unCheckedChildren="正式" />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="啟用狀態"
            valuePropName="checked"
          >
            <Switch checkedChildren="啟用" unCheckedChildren="停用" />
          </Form.Item>

          <Form.Item name="priority" label="優先順序（數字越大越優先）">
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
