'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Radio,
  Upload,
  Space,
  Alert,
  Result,
  Spin,
  message,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import Link from 'next/link';
import { getAccessToken } from '@/lib/api/client';
import {
  getPublicStatus,
  submitApplication,
  uploadScreenshot,
  type PublicStatus,
} from '@/lib/api/forum-push';

const { Title, Paragraph } = Typography;

interface ItemRow {
  key: string;
  type: 'link' | 'screenshot';
  linkValue: string;
  screenshotUrl: string;
  screenshotFile: UploadFile | null;
  uploading: boolean;
}

function makeEmptyRow(): ItemRow {
  return {
    key: Math.random().toString(36).slice(2),
    type: 'link',
    linkValue: '',
    screenshotUrl: '',
    screenshotFile: null,
    uploading: false,
  };
}

export default function ForumPushApplyPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [rows, setRows] = useState<ItemRow[]>([makeEmptyRow()]);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await getPublicStatus();
      setStatus(res);
      // 預設值改用 <Form initialValues={...}>，這裡不再 setFieldsValue
      // 避免 Form 元件在 status=null 時尚未掛載就被呼叫
    } catch {
      message.error('載入資料失敗');
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken('player');
    if (!token) {
      setIsLoggedIn(false);
      setCheckingAuth(false);
      return;
    }
    setIsLoggedIn(true);
    setCheckingAuth(false);
    loadStatus();
  }, [loadStatus]);

  const maxItems = status?.settings.maxItemsPerApplication ?? 5;

  const addRow = () => {
    if (rows.length >= maxItems) {
      message.warning(`最多 ${maxItems} 筆`);
      return;
    }
    setRows((prev) => [...prev, makeEmptyRow()]);
  };

  const removeRow = (key: string) => {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.key !== key),
    );
  };

  const updateRow = (key: string, patch: Partial<ItemRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleUpload = async (key: string, file: File) => {
    updateRow(key, { uploading: true });
    try {
      const res = await uploadScreenshot(file);
      updateRow(key, {
        screenshotUrl: res.url,
        uploading: false,
      });
      message.success('截圖上傳成功');
    } catch {
      updateRow(key, { uploading: false });
      message.error('截圖上傳失敗');
    }
  };

  const handleSubmit = async (values: {
    gameCharacter?: string;
    fbName: string;
    fbLink: string;
  }) => {
    const items = rows.map((r) => ({
      type: r.type,
      content: r.type === 'link' ? r.linkValue.trim() : r.screenshotUrl,
    }));

    const blankIdx = items.findIndex((i) => !i.content);
    if (blankIdx >= 0) {
      message.error(`第 ${blankIdx + 1} 筆尚未填寫/上傳`);
      return;
    }

    setSubmitting(true);
    try {
      await submitApplication({
        gameCharacter: values.gameCharacter || undefined,
        fbName: values.fbName,
        fbLink: values.fbLink,
        items,
      });
      message.success('申請已送出，請等候審核');
      setRows([makeEmptyRow()]);
      await loadStatus();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message || '送出失敗');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAuth) {
    return (
      <div
        style={{
          paddingTop: 'calc(var(--header-total-height, 89px) + 40px)',
          textAlign: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div
        style={{
          paddingTop: 'calc(var(--header-total-height, 89px) + 40px)',
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 40,
        }}
      >
        <Result
          status="403"
          title="需要登入"
          subTitle="請先登入會員帳號才能申請每日推廣獎勵"
          extra={
            <Button type="primary" onClick={() => router.push('/auth/login')}>
              前往登入
            </Button>
          }
        />
      </div>
    );
  }

  if (!status) {
    return (
      <div
        style={{
          paddingTop: 'calc(var(--header-total-height, 89px) + 40px)',
          textAlign: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  const disabled = status.remainingToday <= 0;

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        paddingTop: 'calc(var(--header-total-height, 89px) + 16px)',
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 24,
      }}
    >
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            每日推廣獎勵
          </Title>
          <Link href="/public/forum-push/history">
            <Button icon={<HistoryOutlined />} type="link">
              我的申請紀錄
            </Button>
          </Link>
        </div>

        {status.settings.pageDescription && (
          <Paragraph type="secondary">
            {status.settings.pageDescription}
          </Paragraph>
        )}

        <Alert
          type={disabled ? 'warning' : 'info'}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            disabled
              ? `今日申請次數已達上限（${status.settings.maxApplicationsPerDay} 次），請明日再試`
              : `今日剩餘申請次數：${status.remainingToday} / ${status.settings.maxApplicationsPerDay}，每次最多 ${maxItems} 筆推文`
          }
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={disabled || submitting}
          initialValues={{
            fbName: status.lastFbName ?? '',
            fbLink: status.lastFbLink ?? '',
            gameCharacter: status.gameCharacters[0] ?? '',
          }}
        >
          <Form.Item label="遊戲帳號">
            <Input value={status.gameAccount ?? ''} disabled />
          </Form.Item>

          {status.gameCharacters.length > 0 ? (
            <Form.Item
              label="角色名稱"
              name="gameCharacter"
              rules={[{ required: true, message: '請選擇角色' }]}
            >
              <Select
                options={status.gameCharacters.map((c) => ({
                  label: c,
                  value: c,
                }))}
                placeholder="請選擇角色"
              />
            </Form.Item>
          ) : (
            <Form.Item
              label="角色名稱"
              name="gameCharacter"
              extra="未偵測到遊戲角色，可手動填寫"
            >
              <Input placeholder="角色名稱" />
            </Form.Item>
          )}

          <Form.Item
            label="Facebook 個人名稱"
            name="fbName"
            rules={[{ required: true, message: '請輸入 FB 名稱' }]}
          >
            <Input placeholder="Facebook 個人名稱" />
          </Form.Item>

          <Form.Item
            label="Facebook 個人連結"
            name="fbLink"
            rules={[
              { required: true, message: '請輸入 FB 連結' },
              { type: 'url', message: '請輸入有效的網址' },
            ]}
          >
            <Input placeholder="https://www.facebook.com/..." />
          </Form.Item>

          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            推文清單（最多 {maxItems} 筆）
          </div>

          {rows.map((row, idx) => (
            <Card
              key={row.key}
              size="small"
              style={{ marginBottom: 12 }}
              title={`第 ${idx + 1} 筆`}
              extra={
                rows.length > 1 && (
                  <Button
                    size="small"
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => removeRow(row.key)}
                  >
                    移除
                  </Button>
                )
              }
            >
              <Radio.Group
                value={row.type}
                onChange={(e) =>
                  updateRow(row.key, {
                    type: e.target.value,
                    linkValue: '',
                    screenshotUrl: '',
                    screenshotFile: null,
                  })
                }
                style={{ marginBottom: 8 }}
              >
                <Radio value="link">分享連結</Radio>
                <Radio value="screenshot">截圖上傳</Radio>
              </Radio.Group>

              {row.type === 'link' ? (
                <Input
                  placeholder="https://www.facebook.com/groups/.../permalink/..."
                  value={row.linkValue}
                  onChange={(e) =>
                    updateRow(row.key, { linkValue: e.target.value })
                  }
                />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Upload
                    accept="image/*"
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleUpload(row.key, file);
                      return false;
                    }}
                  >
                    <Button
                      icon={<UploadOutlined />}
                      loading={row.uploading}
                    >
                      {row.screenshotUrl ? '重新上傳' : '選擇截圖'}
                    </Button>
                  </Upload>
                  {row.screenshotUrl && (
                    <a
                      href={row.screenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12 }}
                    >
                      已上傳：{row.screenshotUrl.split('/').pop()}
                    </a>
                  )}
                </Space>
              )}
            </Card>
          ))}

          <Space style={{ marginBottom: 16 }}>
            <Button
              icon={<PlusOutlined />}
              onClick={addRow}
              disabled={rows.length >= maxItems}
            >
              新增連結
            </Button>
          </Space>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              size="large"
              block
            >
              送出申請
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
