'use client';

import { useState } from 'react';
import { Card, Form, Input, Button, message, Alert, Result } from 'antd';
import { applyRefund } from '@/lib/api/commission';

export default function CommissionRefundsPage() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ count: number; txId: string } | null>(null);

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields();
      setSubmitting(true);
      const res = await applyRefund(v.transactionId.trim(), v.reason?.trim() || undefined);
      setResult({ count: res.adjustmentsCreated, txId: v.transactionId.trim() });
      form.resetFields();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (msg) message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="退款沖銷">
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="請先在訂單頁將該筆訂單改為「退款」狀態，再來這裡執行沖銷。"
        description="系統會自動找出該交易對應的 A、B 兩筆分潤紀錄，並在當前期的結算上各自加一筆負值加減項。沖銷一律記在當期，不追改歷史結算。"
      />
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item
          label="交易 ID（payment_transactions.id）"
          name="transactionId"
          rules={[{ required: true, message: '請輸入交易 ID' }]}
        >
          <Input placeholder="UUID" />
        </Form.Item>
        <Form.Item label="原因（選填，會記在 adjustments）" name="reason">
          <Input.TextArea rows={3} placeholder="例如：玩家申請退款，已通過審核" />
        </Form.Item>
        <Button type="primary" danger loading={submitting} onClick={handleSubmit}>
          執行沖銷
        </Button>
      </Form>

      {result && (
        <Result
          status="success"
          style={{ marginTop: 24 }}
          title={`已產生 ${result.count} 筆扣項`}
          subTitle={`交易 ${result.txId} 的分潤已沖銷至本期結算`}
        />
      )}
    </Card>
  );
}
