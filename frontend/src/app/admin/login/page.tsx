'use client';

import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import AuthShell from '@/components/auth/AuthShell';

export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success('登入成功');
      router.push('/platform/dashboard');
    } catch {
      message.error('帳號或密碼錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="主後台管理系統" subtitle="平台管理者專用入口">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="email"
          rules={[
            { required: true, message: '請輸入 Email' },
            { type: 'email', message: '請輸入有效的 Email' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="Email" size="large" autoComplete="username" />
        </Form.Item>
        <Form.Item
          name="password"
          rules={[{ required: true, message: '請輸入密碼' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="密碼" size="large" autoComplete="current-password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            登入
          </Button>
        </Form.Item>
      </Form>
    </AuthShell>
  );
}
