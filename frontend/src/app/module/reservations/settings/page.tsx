'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Form,
  Input,
  Button,
  Switch,
  InputNumber,
  DatePicker,
  message,
  Typography,
  Spin,
  Card,
  Alert,
  Slider,
} from 'antd';
import ImageUpload from '@/components/ui/ImageUpload';
import { getPageSettings, updatePageSettings } from '@/lib/api/reserve';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function ReserveSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getPageSettings();
      form.setFieldsValue({
        pageTitle: settings.pageTitle ?? '',
        pageSubtitle: settings.pageSubtitle ?? '',
        pageDescription: settings.pageDescription ?? '',
        countBase: settings.countBase ?? 0,
        deadlineAt: settings.deadlineAt ? dayjs(settings.deadlineAt) : null,
        isDistributionLocked: settings.isDistributionLocked ?? false,
        heroBackgroundUrl: settings.heroBackgroundUrl ?? '',
        heroOverlayOpacity: settings.heroOverlayOpacity ?? 0.55,
      });
    } catch {
      message.error('載入設定失敗');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const payload = {
        pageTitle: values.pageTitle,
        pageSubtitle: values.pageSubtitle || null,
        pageDescription: values.pageDescription || null,
        countBase: values.countBase ?? 0,
        deadlineAt: values.deadlineAt ? values.deadlineAt.toISOString() : null,
        isDistributionLocked: !!values.isDistributionLocked,
        heroBackgroundUrl: values.heroBackgroundUrl || null,
        heroOverlayOpacity:
          typeof values.heroOverlayOpacity === 'number'
            ? values.heroOverlayOpacity
            : 0.55,
      };
      await updatePageSettings(payload);
      message.success('儲存成功');
    } catch (err) {
      // validateFields 失敗時 err 會是 ErrorInfo，不另外 toast
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>新兵報到 — 頁面設定</Title>
        <Button type="primary" onClick={handleSave} loading={saving}>
          儲存設定
        </Button>
      </div>

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="顯示人數 = 種子人數 + 實際預約人數；獎勵只會發放給實際預約者。"
      />

      <Form form={form} layout="vertical" style={{ maxWidth: 720 }}>
        <Card title="文案設定" style={{ marginBottom: 16 }}>
          <Form.Item
            name="pageTitle"
            label="頁面標題"
            rules={[{ required: true, message: '請輸入頁面標題' }]}
          >
            <Input placeholder="新兵報到" />
          </Form.Item>

          <Form.Item name="pageSubtitle" label="副標題">
            <Input placeholder="搶先預約，開服即享獨家好禮！" />
          </Form.Item>

          <Form.Item name="pageDescription" label="說明文字">
            <TextArea rows={4} placeholder="詳細說明..." />
          </Form.Item>
        </Card>

        <Card title="Hero 視覺" style={{ marginBottom: 16 }}>
          <Form.Item
            name="heroBackgroundUrl"
            label="全畫面背景圖"
            extra={
              <Text type="secondary">
                建議尺寸 1920×1080 以上，深色系效果最好；不上傳則使用預設漸層。
              </Text>
            }
          >
            <ImageUpload folder="reserve" />
          </Form.Item>

          <Form.Item
            name="heroOverlayOpacity"
            label="遮罩透明度"
            extra={
              <Text type="secondary">
                0 = 完全透明（背景最亮）；1 = 全黑。建議 0.4–0.7 讓文字易讀。
              </Text>
            }
          >
            <Slider
              min={0}
              max={1}
              step={0.05}
              marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
            />
          </Form.Item>
        </Card>

        <Card title="人數與期限" style={{ marginBottom: 16 }}>
          <Form.Item
            name="countBase"
            label="種子人數（基礎顯示數）"
            extra={
              <Text type="secondary">
                僅影響前台顯示人數，不會收到獎勵；用來做開場氣氛。
              </Text>
            }
            rules={[{ required: true, message: '請輸入種子人數' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="deadlineAt"
            label="預約截止 / 開服日期"
            extra={<Text type="secondary">到期後前台將停止新增預約。</Text>}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Card>

        <Card title="獎勵發放控制">
          <Form.Item
            name="isDistributionLocked"
            label="鎖定名單（停止新增預約）"
            valuePropName="checked"
            extra={
              <Text type="secondary">
                準備發獎時開啟，之後前台不再接受新預約。
              </Text>
            }
          >
            <Switch />
          </Form.Item>
        </Card>
      </Form>
    </div>
  );
}
