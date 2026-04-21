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
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { getSettings, updateLineBotSettings, updateLineInviteSettings, updateGameDbSettings, testGameDbConnection, updateGameTableMapping, fetchTableColumns } from '@/lib/api/settings';
import type {
  LineBotSettingsDto,
  LineInviteSettingsDto,
  GameDbSettingsDto,
  GameTableMappingDto,
  PasswordEncryption,
} from '@/lib/types';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [lineBotSubmitting, setLineBotSubmitting] = useState(false);
  const [lineBotForm] = Form.useForm<LineBotSettingsDto>();

  // LINE 邀請浮窗
  const [lineInviteForm] = Form.useForm<LineInviteSettingsDto>();
  const [lineInviteSubmitting, setLineInviteSubmitting] = useState(false);

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
      });

      const lineInvite = settings.lineInvite as Record<string, unknown>;
      lineInviteForm.setFieldsValue({
        enabled: Boolean(lineInvite?.enabled),
        inviteUrl: (lineInvite?.inviteUrl as string) || '',
        showQrCode: lineInvite?.showQrCode !== false,
        tooltip: (lineInvite?.tooltip as string) || '加入官方 LINE',
        inviteCaption: (lineInvite?.inviteCaption as string) || '官方 LINE',
        tradingGroupUrl: (lineInvite?.tradingGroupUrl as string) || '',
        tradingGroupCaption: (lineInvite?.tradingGroupCaption as string) || '官方交易群',
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
  }, [lineBotForm, lineInviteForm, gameDbForm, tableMappingForm]);

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

  const handleLineInviteSave = async () => {
    try {
      const values = await lineInviteForm.validateFields();
      setLineInviteSubmitting(true);
      await updateLineInviteSettings(values);
      message.success('LINE 邀請浮窗設定儲存成功');
    } catch {
      message.error('LINE 邀請浮窗設定儲存失敗');
    } finally {
      setLineInviteSubmitting(false);
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


  return (
    <div>
      <h2>模組設定</h2>
      <Spin spinning={loading}>
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

        {/* ─── LINE 邀請浮窗設定 ────────────────────── */}
        <Card title="LINE 邀請浮窗（前台右下角）">
          <Form form={lineInviteForm} layout="vertical">
            <Form.Item
              name="enabled"
              label="啟用浮窗"
              valuePropName="checked"
              tooltip="關閉後前台右下角不會顯示 LINE 按鈕"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="inviteUrl"
              label="官方 LINE 好友邀請連結"
              rules={[{ type: 'url', message: '請輸入有效的網址' }]}
              extra="例如：https://line.me/R/ti/p/@xxxxxx"
            >
              <Input placeholder="https://line.me/R/ti/p/@xxxxxx" />
            </Form.Item>
            <Form.Item
              name="inviteCaption"
              label="官方 LINE QR Code 下方說明文字"
              tooltip="顯示於浮窗彈出後，官方 LINE QR 圖片下方"
            >
              <Input placeholder="例如：官方 LINE" maxLength={100} />
            </Form.Item>
            <Form.Item
              name="tradingGroupUrl"
              label="官方交易群連結"
              rules={[{ type: 'url', message: '請輸入有效的網址' }]}
              extra="留空則浮窗僅顯示官方 LINE 一組 QR Code"
            >
              <Input placeholder="https://line.me/R/ti/g/xxxxxx" />
            </Form.Item>
            <Form.Item
              name="tradingGroupCaption"
              label="官方交易群 QR Code 下方說明文字"
              tooltip="顯示於浮窗彈出後，交易群 QR 圖片下方"
            >
              <Input placeholder="例如：官方交易群" maxLength={100} />
            </Form.Item>
            <Form.Item
              name="showQrCode"
              label="同時顯示 QR Code"
              valuePropName="checked"
              tooltip="關閉後彈窗僅顯示文字連結按鈕，不會顯示 QR Code"
            >
              <Switch />
            </Form.Item>
            <Form.Item name="tooltip" label="按鈕提示文字">
              <Input placeholder="加入官方 LINE" maxLength={100} />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                loading={lineInviteSubmitting}
                onClick={handleLineInviteSave}
              >
                儲存 LINE 邀請設定
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
