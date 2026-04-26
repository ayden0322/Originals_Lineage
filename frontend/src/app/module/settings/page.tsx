'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Spin,
  Divider,
  message,
  InputNumber,
  Tag,
  Space,
  Checkbox,
  Radio,
  Select,
  Switch,
  Alert,
  Popover,
  List,
  Empty,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  PlusOutlined,
  DeleteOutlined,
  SendOutlined,
  ReloadOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import {
  getSettings,
  updateLineBotSettings,
  testLineBotPush,
  getLineRecentSources,
  updateGameDbSettings,
  testGameDbConnection,
  updateGameTableMapping,
  fetchTableColumns,
} from '@/lib/api/settings';
import type {
  LineBotSettingsDto,
  LineRecentSource,
  GameDbSettingsDto,
  GameTableMappingDto,
  PasswordEncryption,
} from '@/lib/types';

const WEBHOOK_PATH = '/line/webhook/originals-lineage';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [lineBotSubmitting, setLineBotSubmitting] = useState(false);
  const [lineBotForm] = Form.useForm<LineBotSettingsDto>();
  const [recentSources, setRecentSources] = useState<LineRecentSource[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [testingGroupId, setTestingGroupId] = useState<string | null>(null);

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
      const settings = await getSettings();

      const lineBot = settings.lineBot as Record<string, unknown>;
      lineBotForm.setFieldsValue({
        channelId: (lineBot.channelId as string) || '',
        channelSecret: (lineBot.channelSecret as string) || '',
        channelAccessToken: (lineBot.channelAccessToken as string) || '',
        rechargeNotifyEnabled: Boolean(lineBot.rechargeNotifyEnabled),
        notifyGroups:
          (lineBot.notifyGroups as LineBotSettingsDto['notifyGroups']) || [],
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
      // 補預設：每個群組若沒勾事件，預設訂閱 'recharge'
      const dto: LineBotSettingsDto = {
        ...values,
        notifyGroups: (values.notifyGroups || []).map((g) => ({
          groupId: g.groupId.trim(),
          name: (g.name || '').trim(),
          events: g.events && g.events.length ? g.events : ['recharge'],
        })),
      };
      setLineBotSubmitting(true);
      await updateLineBotSettings(dto);
      message.success('LINE Bot 設定儲存成功');
    } catch {
      message.error('LINE Bot 設定儲存失敗');
    } finally {
      setLineBotSubmitting(false);
    }
  };

  const handleTestPush = async (groupId: string) => {
    if (!groupId) {
      message.warning('請先填入 Group ID');
      return;
    }
    setTestingGroupId(groupId);
    try {
      const result = await testLineBotPush(groupId);
      if (result.success) {
        message.success('測試訊息已送出，請至 LINE 群組確認');
      } else {
        message.error(`測試失敗：${result.message}`);
      }
    } catch {
      message.error('測試失敗（請先儲存 Channel Access Token）');
    } finally {
      setTestingGroupId(null);
    }
  };

  const handleRefreshRecent = async () => {
    setRecentLoading(true);
    try {
      const list = await getLineRecentSources();
      setRecentSources(list);
    } catch {
      message.error('讀取最近事件失敗');
    } finally {
      setRecentLoading(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`已複製${label}`);
    } catch {
      message.error('複製失敗');
    }
  };

  const webhookUrl = (() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    return `${base}${WEBHOOK_PATH}`;
  })();

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


  return (
    <div>
      <h2>模組設定</h2>
      <Spin spinning={loading}>
        {/* ─── LINE Bot 設定 ──────────────────────────── */}
        <Card title="LINE Bot 設定">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Webhook URL（請貼到 LINE Developers Console）"
            description={
              <Space>
                <Typography.Text code copyable={false} style={{ fontSize: 13 }}>
                  {webhookUrl}
                </Typography.Text>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(webhookUrl, 'Webhook URL')}
                >
                  複製
                </Button>
              </Space>
            }
          />

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

            <Divider orientation="left" plain>
              儲值通知
            </Divider>

            <Form.Item
              name="rechargeNotifyEnabled"
              label="啟用儲值通知（玩家儲值發貨完成 / 失敗時推訊息到指定群組）"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item label="通知群組">
              <Space style={{ marginBottom: 8 }}>
                <Popover
                  trigger="click"
                  title={
                    <Space>
                      <span>最近收到的群組事件</span>
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={recentLoading}
                        onClick={handleRefreshRecent}
                      >
                        重新整理
                      </Button>
                    </Space>
                  }
                  content={
                    <div style={{ width: 360, maxHeight: 300, overflow: 'auto' }}>
                      {recentSources.length === 0 ? (
                        <Empty
                          description="尚無事件。請把 Bot 加入群組後再點「重新整理」"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      ) : (
                        <List
                          size="small"
                          dataSource={recentSources}
                          renderItem={(s) => {
                            const id = s.groupId || s.roomId || s.userId || '';
                            return (
                              <List.Item
                                actions={[
                                  <Button
                                    key="copy"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={() => handleCopy(id, 'ID')}
                                  >
                                    複製 ID
                                  </Button>,
                                ]}
                              >
                                <Space direction="vertical" size={0}>
                                  <span>
                                    <Tag color={s.type === 'group' ? 'blue' : 'default'}>
                                      {s.type}
                                    </Tag>
                                    <Tag>{s.eventType}</Tag>
                                  </span>
                                  <Typography.Text code style={{ fontSize: 11 }}>
                                    {id}
                                  </Typography.Text>
                                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                    {new Date(s.receivedAt).toLocaleString()}
                                  </Typography.Text>
                                </Space>
                              </List.Item>
                            );
                          }}
                        />
                      )}
                    </div>
                  }
                  onOpenChange={(open) => {
                    if (open) handleRefreshRecent();
                  }}
                >
                  <Button size="small" icon={<ReloadOutlined />}>
                    從最近事件挑選 Group ID
                  </Button>
                </Popover>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Bot 加入群組後，這裡會自動收到 join / message 事件
                </Typography.Text>
              </Space>

              <Form.List name="notifyGroups">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {fields.map(({ key, name, ...rest }) => (
                      <Space
                        key={key}
                        align="baseline"
                        style={{ display: 'flex', flexWrap: 'wrap' }}
                      >
                        <Form.Item
                          {...rest}
                          name={[name, 'groupId']}
                          rules={[{ required: true, message: '請填入 Group ID' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="Group ID（C 開頭）" style={{ width: 280 }} />
                        </Form.Item>
                        <Form.Item
                          {...rest}
                          name={[name, 'name']}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="顯示名稱（管理群、客服群…）" style={{ width: 200 }} />
                        </Form.Item>
                        <Form.Item
                          {...rest}
                          name={[name, 'events']}
                          initialValue={['recharge']}
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            mode="multiple"
                            style={{ width: 160 }}
                            options={[{ label: '儲值通知', value: 'recharge' }]}
                          />
                        </Form.Item>
                        <Button
                          icon={<SendOutlined />}
                          loading={
                            testingGroupId ===
                            lineBotForm.getFieldValue(['notifyGroups', name, 'groupId'])
                          }
                          onClick={() => {
                            const gid = lineBotForm.getFieldValue([
                              'notifyGroups',
                              name,
                              'groupId',
                            ]) as string | undefined;
                            handleTestPush(gid || '');
                          }}
                        >
                          測試
                        </Button>
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        >
                          移除
                        </Button>
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => add({ events: ['recharge'] })}
                    >
                      新增群組
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>

            <Form.Item style={{ marginTop: 16 }}>
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

    </div>
  );
}
