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
    <Card title="進階：依交易 ID 補沖銷">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="一般退款請直接到「訂單管理」找出該筆訂單，點『退款』按鈕。"
        description={
          <>
            此頁僅供例外情境使用：訂單資料遺失、或有 <code>payment_transactions.id</code>
            但查不到對應訂單時，才需要在這裡手動沖銷分潤。<br />
            系統會自動找出該交易對應的 A、B 兩筆分潤紀錄，並在當期結算上各自加一筆負值加減項。
            沖銷一律記在當期，不追改歷史結算。同一交易若已沖銷，會被阻擋重複執行。
          </>
        }
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
