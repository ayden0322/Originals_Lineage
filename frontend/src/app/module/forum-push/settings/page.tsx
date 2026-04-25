'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Input,
  Radio,
  Button,
  Space,
  Spin,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { getSettings, updateSettings } from '@/lib/api/forum-push';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

export default function ForumPushSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        form.setFieldsValue(s);
      } catch {
        message.error('載入設定失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, [form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await updateSettings({
        maxApplicationsPerDay: values.maxApplicationsPerDay,
        maxItemsPerApplication: values.maxItemsPerApplication,
        duplicateUrlPolicy: values.duplicateUrlPolicy,
        pageDescription: values.pageDescription ?? undefined,
      });
      message.success('已儲存');
    } catch {
      message.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link href="/module/forum-push">
          <Button icon={<ArrowLeftOutlined />}>返回列表</Button>
        </Link>
      </Space>

      <Card>
        <Title level={4}>每日推廣審核設定</Title>
        <Paragraph type="secondary">
          影響玩家每日可送出申請次數、每次可填筆數，以及跨申請重複連結的處理方式。
        </Paragraph>

        <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item
            name="maxApplicationsPerDay"
            label="每人每日申請次數上限"
            rules={[{ required: true, message: '請輸入次數' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="maxItemsPerApplication"
            label="每次申請可填推文筆數上限"
            rules={[{ required: true, message: '請輸入筆數' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="duplicateUrlPolicy"
            label="重複連結處理"
            rules={[{ required: true }]}
            extra="當有玩家提交的推文連結，跨申請與歷史紀錄重複時要怎麼處理"
          >
            <Radio.Group>
              <Radio value="warn">僅標示提示（審核時顯示）</Radio>
              <Radio value="block">直接擋下（送出時拒絕）</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="pageDescription"
            label="前台活動說明"
            extra="顯示於前台申請頁上方"
          >
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" onClick={handleSave} loading={saving}>
              儲存設定
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
