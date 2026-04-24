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
import { SaveOutlined, ShopOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
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
      const toHex = (v: unknown, fallback: string): string => {
        if (typeof v === 'string') return v || fallback;
        if (v && typeof (v as { toHexString?: () => string }).toHexString === 'function') {
          return (v as { toHexString: () => string }).toHexString();
        }
        return fallback;
      };
      const payload: Partial<ShopSettings> = {
        ...values,
        heroTextColor: toHex(values.heroTextColor, '#ffffff'),
        currencyColor: toHex(values.currencyColor, '#c4a24e'),
        accentColor: toHex(values.accentColor, '#c4a24e'),
        bonusTiers: (values.bonusTiers ?? [])
          .filter((t) => t && Number.isFinite(Number(t.minAmount)) && Number.isFinite(Number(t.ratio)))
          .map((t) => ({ minAmount: Number(t.minAmount), ratio: Number(t.ratio) }))
          .sort((a, b) => a.minAmount - b.minAmount),
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
        贊助頁設定
      </Title>
      <Paragraph type="secondary">
        調整公開「贊助」頁的外觀。儲存後立即生效，前台重新整理即可看到。
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
            <Input placeholder="例如：贊助支持" />
          </Form.Item>

          <Form.Item label="副標題" name="heroSubtitle">
            <Input placeholder="例如：選購四海銀票，支持伺服器營運" />
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

          {/* ─── 貨幣顯示 ─────────────────────────────────────── */}
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
            <ImageUpload folder="shop" />
          </Form.Item>

          <Form.Item label="貨幣顏色" name="currencyColor">
            <ColorPicker showText format="hex" />
          </Form.Item>

          {/* ─── 主色 ────────────────────────────────────────── */}
          <Divider orientation="left">主色（Tag / 強調色）</Divider>

          <Form.Item
            label="主色"
            name="accentColor"
            tooltip="用於限購資訊 Tag 等強調色塊"
          >
            <ColorPicker showText format="hex" />
          </Form.Item>

          {/* ─── 贊助加碼比值 ──────────────────────────────── */}
          <Divider orientation="left">贊助加碼比值</Divider>
          <Paragraph type="secondary" style={{ marginTop: -8 }}>
            前台贊助確認畫面會依「總金額」套用對應倍率顯示「共獲得」數量。
            實際送出到後端/資料庫的數量不會被加碼（遊戲內有機制自動轉換）。
            金額下限為「含」，由小到大依序套用，取符合條件的最高一檔。
          </Paragraph>

          <Form.List name="bonusTiers">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space
                    key={field.key}
                    align="baseline"
                    style={{ display: 'flex', marginBottom: 8 }}
                  >
                    <Form.Item
                      {...field}
                      label="金額下限 NT$"
                      name={[field.name, 'minAmount']}
                      rules={[{ required: true, message: '必填' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={100} style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      label="倍率"
                      name={[field.name, 'ratio']}
                      rules={[{ required: true, message: '必填' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={0.1} style={{ width: 120 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add({ minAmount: 0, ratio: 1 })}
                    icon={<PlusOutlined />}
                    block
                  >
                    新增區間
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

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
