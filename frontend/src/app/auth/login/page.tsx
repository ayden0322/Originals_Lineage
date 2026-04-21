'use client';

import { Suspense, useState } from 'react';
import { Form, Input, Button, message, Spin } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import * as authApi from '@/lib/api/auth';
import { setTokens } from '@/lib/api/client';
import AuthShell from '@/components/auth/AuthShell';

export default function PlayerLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}><Spin size="large" /></div>}>
      <PlayerLoginContent />
    </Suspense>
  );
}

function PlayerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const redirect = searchParams.get('redirect') || '/public';

  const onFinish = async (values: { gameAccountName: string; password: string }) => {
    setLoading(true);
    try {
      const tokens = await authApi.playerLogin(values.gameAccountName, values.password);
      setTokens('player', tokens.accessToken, tokens.refreshToken);
      message.success('登入成功');
      router.push(redirect);
    } catch {
      message.error('帳號或密碼錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="玩家登入" subtitle="請輸入遊戲帳號與密碼">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="gameAccountName"
          rules={[
            { required: true, message: '請輸入遊戲帳號' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含英文、數字和底線' },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder="遊戲帳號" size="large" autoComplete="username" />
        </Form.Item>
        <Form.Item
          name="password"
          rules={[{ required: true, message: '請輸入密碼' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="密碼" size="large" autoComplete="current-password" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 16 }}>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            登入
          </Button>
        </Form.Item>
        <div style={{ textAlign: 'center', fontSize: 13 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>還沒有帳號？</span>
          <a href="/auth/register" style={{ color: '#c4a24e', marginLeft: 4 }}>立即註冊</a>
        </div>
      </Form>
    </AuthShell>
  );
}
