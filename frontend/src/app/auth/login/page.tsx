'use client';

import { Suspense, useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Spin } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import * as authApi from '@/lib/api/auth';
import { setTokens } from '@/lib/api/client';

const { Title } = Typography;

export default function PlayerLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>}>
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card style={{ width: 420, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          玩家登入
        </Title>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="gameAccountName"
            rules={[
              { required: true, message: '請輸入遊戲帳號' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含英文、數字和底線' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="遊戲帳號" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '請輸入密碼' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密碼" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              登入
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <a href="/auth/register">還沒有帳號？立即註冊</a>
          </div>
        </Form>
      </Card>
    </div>
  );
}
