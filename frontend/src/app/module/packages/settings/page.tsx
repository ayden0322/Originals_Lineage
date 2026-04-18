'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Switch,
  InputNumber,
  Select,
  Button,
  Spin,
  Typography,
  message,
  Divider,
  Space,
  ColorPicker,
} from 'antd';
import { SaveOutlined, GiftOutlined } from '@ant-design/icons';
import ImageUpload from '@/components/ui/ImageUpload';
import {
  getPackageSettings,
  updatePackageSettings,
} from '@/lib/api/package-manage';
import type { PackageSettings } from '@/lib/types';

const { Title, Paragraph } = Typography;

/** ColorPicker value 可能是字串或 AntColor 物件 */
function toHex(v: unknown, fallback: string): string {
  if (typeof v === 'string') return v || fallback;
  if (v && typeof (v as { toHexString?: () => string }).toHexString === 'function') {
    return (v as { toHexString: () => string }).toHexString();
  }
  return fallback;
}

export default function PackageSettingsPage() {
  const [form] = Form.useForm<PackageSettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPackageSettings();
        form.setFieldsValue(data);
      } catch {
        message.error('載入禮包頁設定失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      // ColorPicker 回傳物件 → 轉字串
      const payload: Partial<PackageSettings> = {
        ...values,
        heroTextColor: toHex(values.heroTextColor, '#ffffff'),
        currencyColor: toHex(values.currencyColor, '#c4a24e'),
        cardBorderColor: toHex(values.cardBorderColor, 'transparent'),
        accentColor: toHex(values.accentColor, '#c4a24e'),
      };
      setSaving(true);
      const updated = await updatePackageSettings(payload);
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
        <GiftOutlined style={{ marginRight: 8 }} />
        禮包頁設定
      </Title>
      <Paragraph type="secondary">
        調整公開「禮包內容」頁的外觀。儲存後立即生效，前台重新整理即可看到。
      </Paragraph>

      <Card>
        <Form form={form} layout="vertical">
          {/* ─── Hero 區 ─────────────────────────────────────── */}
          <Divider orientation="left">Hero 區（頁首橫幅）</Divider>

          <Form.Item
            label="顯示 Hero 區"
            name="heroEnabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item label="標題" name="heroTitle">
            <Input placeholder="例如：禮包內容" />
          </Form.Item>

          <Form.Item label="副標題" name="heroSubtitle">
            <Input placeholder="例如：用四海銀票，兌換精選禮包" />
          </Form.Item>

          <Form.Item label="背景圖" name="heroBgImageUrl">
            <ImageUpload folder="packages" />
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

          {/* ─── 貨幣設定 ─────────────────────────────────────── */}
          <Divider orientation="left">貨幣設定（顯示於卡片與詳情）</Divider>

          <Form.Item
            label="貨幣名稱"
            name="currencyName"
            tooltip="例如：四海銀票、鑽石、金幣"
          >
            <Input placeholder="四海銀票" />
          </Form.Item>

          <Form.Item
            label="貨幣 Icon"
            name="currencyIconUrl"
            tooltip="顯示在數量旁的小圖示"
          >
            <ImageUpload folder="packages" />
          </Form.Item>

          <Form.Item label="貨幣顏色" name="currencyColor">
            <ColorPicker showText format="hex" />
          </Form.Item>

          {/* ─── 卡片視覺 ─────────────────────────────────────── */}
          <Divider orientation="left">卡片視覺</Divider>

          <Form.Item
            label="每列欄數"
            name="cardColumns"
            tooltip="桌機版每列顯示的卡片數（1~6）"
          >
            <InputNumber min={1} max={6} />
          </Form.Item>

          <Form.Item
            label="卡片圖片比例"
            name="cardImageRatio"
            tooltip="決定卡片封面圖的長寬比"
          >
            <Select
              style={{ width: 160 }}
              options={[
                { value: '1:1', label: '1:1（正方形）' },
                { value: '4:3', label: '4:3（橫向）' },
                { value: '3:4', label: '3:4（直向）' },
                { value: '16:9', label: '16:9（寬螢幕）' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="卡片圓角（px）"
            name="cardBorderRadius"
            tooltip="0 為直角，建議 8~16"
          >
            <InputNumber min={0} max={32} />
          </Form.Item>

          <Form.Item
            label="卡片邊框顏色"
            name="cardBorderColor"
            tooltip="若想隱藏邊框，可設為 transparent"
          >
            <ColorPicker showText format="hex" />
          </Form.Item>

          {/* ─── 主色 ────────────────────────────────────────── */}
          <Divider orientation="left">主色（Tag/強調色）</Divider>

          <Form.Item
            label="主色"
            name="accentColor"
            tooltip="用於禮包內容物數量 Tag 等強調色塊"
          >
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
