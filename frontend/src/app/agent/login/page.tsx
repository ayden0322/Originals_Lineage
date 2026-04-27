'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { agentLogin } from '@/lib/api/commission';
import { setTokens } from '@/lib/api/client';
import AuthShell from '@/components/auth/AuthShell';

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
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      if (err?.response?.status === 429) {
        // 429 已由 axios interceptor 顯示限流訊息，跳過避免重複 toast
        return;
      }
      const msg = err.response?.data?.message;
      message.error(msg || '登入失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="代理後台" subtitle="請使用管理者建立的代理帳號登入">
      <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
        <Form.Item
          label="登入帳號"
          name="loginAccount"
          rules={[{ required: true, message: '請輸入帳號' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="代理登入帳號" size="large" />
        </Form.Item>
        <Form.Item
          label="密碼"
          name="password"
          rules={[{ required: true, message: '請輸入密碼' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="密碼" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block size="large">
          登入
        </Button>
      </Form>
    </AuthShell>
  );
}
