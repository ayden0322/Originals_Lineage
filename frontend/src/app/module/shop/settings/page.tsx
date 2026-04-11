'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Switch,
  InputNumber,
  Button,
  Spin,
  Typography,
  message,
  Divider,
  Space,
  ColorPicker,
} from 'antd';
import { SaveOutlined, ShopOutlined } from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import { getShopSettings, updateShopSettings } from '@/lib/api/shop-manage';
import type { ShopSettings } from '@/lib/types';

const { Title, Paragraph } = Typography;

export default function ShopSettingsPage() {
  const [form] = Form.useForm<ShopSettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getShopSettings();
        form.setFieldsValue(data);
      } catch {
        message.error('載入商城設定失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      // ColorPicker 回傳的是物件，需要轉成字串
      const payload: Partial<ShopSettings> = {
        ...values,
        heroTextColor:
          typeof values.heroTextColor === 'string'
            ? values.heroTextColor
            : (values.heroTextColor as unknown as { toHexString: () => string }).toHexString(),
      };
      setSaving(true);
      const updated = await updateShopSettings(payload);
      form.setFieldsValue(updated);
      message.success('已儲存');
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      if (e?.response?.data?.message) {
        message.error(e.response.data.message);
      } else {
        message.error('儲存失敗');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <Title level={3}>
        <ShopOutlined style={{ marginRight: 8 }} />
        商城設定
      </Title>
      <Paragraph type="secondary">
        調整公開商城頁的外觀。儲存後立即生效，前台重新整理即可看到。
      </Paragraph>

      <Card>
        <Form form={form} layout="vertical">
          <Divider orientation="left">Hero 區（頁首橫幅）</Divider>

          <Form.Item
            label="顯示 Hero 區"
            name="heroEnabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item label="標題" name="heroTitle">
            <Input placeholder="例如：始祖商城" />
          </Form.Item>

          <Form.Item label="副標題" name="heroSubtitle">
            <Input placeholder="例如：選購超值商品，開啟您的冒險之旅" />
          </Form.Item>

          <Form.Item label="背景圖" name="heroBgImageUrl">
            <ImageUpload folder="shop" />
          </Form.Item>

          <Form.Item
            label="高度（px）"
            name="heroHeight"
            tooltip="Hero 區的最小高度，建議 180~480 之間"
          >
            <InputNumber min={120} max={800} step={20} />
          </Form.Item>

          <Form.Item label="文字顏色" name="heroTextColor">
            <ColorPicker showText format="hex" />
          </Form.Item>

          <Divider />

          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              儲存設定
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
