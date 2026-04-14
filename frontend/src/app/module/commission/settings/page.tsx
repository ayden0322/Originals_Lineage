'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Button,
  message,
  Alert,
  Spin,
} from 'antd';
import {
  getCommissionSettings,
  updateCommissionSetting,
} from '@/lib/api/commission';

interface SettingsState {
  settlement_day: number;
  cookie_days: number;
  mask_player_id_for_agents: boolean;
  self_referral_default: boolean;
  max_sub_rate: number;
}

export default function CommissionSettingsPage() {
  const [form] = Form.useForm<SettingsState>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getCommissionSettings();
      form.setFieldsValue({
        settlement_day: Number(data.settlement_day ?? 5),
        cookie_days: Number(data.cookie_days ?? 30),
        mask_player_id_for_agents: !!data.mask_player_id_for_agents,
        self_referral_default: !!data.self_referral_default,
        max_sub_rate: Number(data.max_sub_rate ?? 1),
      });
    } catch {
      message.error('載入設定失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      // 一個一個 set（避免不同 key 用同一個 endpoint 導致只送最後一個）
      const entries = Object.entries(values);
      for (const [key, value] of entries) {
        await updateCommissionSetting(key, value);
      }
      message.success('已儲存（settlement_day 變更於下期生效，其他即時生效）');
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (msg) message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="分潤系統設定">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="重要規則"
        description={
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>結算日（settlement_day）變更採「預約下期生效」：當期照舊，下期才用新值</li>
            <li>結算日 &gt; 當月天數時自動抓當月最後一天（例如 31 號 → 2 月為 28 / 29）</li>
            <li>其他設定即時生效</li>
          </ul>
        }
      />

      <Spin spinning={loading}>
        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item
            label="結算日（每月幾號）"
            name="settlement_day"
            rules={[{ required: true }]}
            extra="例如 5 = 每月 5 號 00:00 執行結算"
          >
            <InputNumber min={1} max={31} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="推薦 Cookie 有效天數"
            name="cookie_days"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="代理後台是否遮罩玩家 ID"
            name="mask_player_id_for_agents"
            valuePropName="checked"
            extra="關閉後代理可看到完整玩家 ID（建議保持開啟）"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="新代理預設「允許自推自玩」"
            name="self_referral_default"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="A 設定 B 比例的上限（max_sub_rate）"
            name="max_sub_rate"
            extra="0~1 之間，預設 1.0 = 不限制"
          >
            <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
          </Form.Item>
          <Button type="primary" onClick={handleSave} loading={saving}>
            儲存
          </Button>
        </Form>
      </Spin>
    </Card>
  );
}
