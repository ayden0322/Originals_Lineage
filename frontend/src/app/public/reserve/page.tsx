'use client';

import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Typography, Statistic, message, Result, Spin } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { createReservation, getReservationCount } from '@/lib/api/reserve';

const { Title, Paragraph } = Typography;

interface ReserveFormValues {
  email: string;
  displayName: string;
  phone?: string;
  lineId?: string;
  referralCode?: string;
}

export default function ReservePage() {
  const [form] = Form.useForm<ReserveFormValues>();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [countLoading, setCountLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const c = await getReservationCount();
        setCount(c);
      } catch {
        // ignore
      } finally {
        setCountLoading(false);
      }
    };
    fetchCount();
  }, []);

  const onFinish = async (values: ReserveFormValues) => {
    setLoading(true);
    try {
      await createReservation({
        email: values.email,
        displayName: values.displayName,
        phone: values.phone || undefined,
        lineId: values.lineId || undefined,
        referralCode: values.referralCode || undefined,
      });
      message.success('預約成功！');
      setSubmitted(true);
      setCount((prev) => prev + 1);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || '預約失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 'calc(var(--header-total-height, 89px) + 24px)' }}>
        <Result
          status="success"
          title="預約成功！"
          subTitle="感謝您的事前預約，我們將在開服前通知您。請留意您的信箱。"
          extra={[
            <Button
              type="primary"
              key="home"
              onClick={() => (window.location.href = '/public')}
            >
              返回首頁
            </Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 'calc(var(--header-total-height, 89px) + 24px)' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2}>事前預約</Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          搶先預約，開服即享獨家好禮！
        </Paragraph>
        {countLoading ? (
          <Spin />
        ) : (
          <Statistic
            title="目前預約人數"
            value={count}
            suffix="人"
            valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
            prefix={<UserOutlined />}
          />
        )}
      </div>

      <Card style={{ borderRadius: 12 }}>
        <Form<ReserveFormValues>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="email"
            label="電子信箱"
            rules={[
              { required: true, message: '請輸入電子信箱' },
              { type: 'email', message: '請輸入有效的電子信箱' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="your@email.com"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="displayName"
            label="暱稱"
            rules={[{ required: true, message: '請輸入暱稱' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="您的暱稱"
              size="large"
            />
          </Form.Item>

          <Form.Item name="phone" label="手機號碼">
            <Input
              prefix={<PhoneOutlined />}
              placeholder="09xxxxxxxx（選填）"
              size="large"
            />
          </Form.Item>

          <Form.Item name="lineId" label="LINE ID">
            <Input placeholder="您的 LINE ID（選填）" size="large" />
          </Form.Item>

          <Form.Item name="referralCode" label="推薦碼">
            <Input placeholder="推薦碼（選填）" size="large" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{ height: 48 }}
            >
              立即預約
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
