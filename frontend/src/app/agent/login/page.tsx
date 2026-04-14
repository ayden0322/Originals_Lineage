'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { agentLogin } from '@/lib/api/commission';
import { setTokens } from '@/lib/api/client';

export default function AgentLoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: { loginAccount: string; password: string }) => {
    setSubmitting(true);
    try {
      const res = await agentLogin(values.loginAccount, values.password);
      // agent 沒有 refresh token,但 setTokens 簽名要兩個,給空字串
      setTokens('agent', res.accessToken, '');
      message.success(`歡迎，${res.agent.code} ${res.agent.name}`);
      router.push('/agent/dashboard');
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || '登入失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1f2a5e 0%, #2d3a7e 100%)',
      }}
    >
      <Card style={{ width: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            始祖天堂 代理後台
          </Typography.Title>
          <Typography.Text type="secondary">
            請使用管理者建立的代理帳號登入
          </Typography.Text>
        </div>
        <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            label="登入帳號"
            name="loginAccount"
            rules={[{ required: true, message: '請輸入帳號' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="代理登入帳號" />
          </Form.Item>
          <Form.Item
            label="密碼"
            name="password"
            rules={[{ required: true, message: '請輸入密碼' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密碼" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            登入
          </Button>
        </Form>
      </Card>
    </div>
  );
}
