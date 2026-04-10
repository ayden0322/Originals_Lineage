'use client';

import { useState, useCallback } from 'react';
import { Card, Form, Input, Button, Typography, message, Alert, Spin } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import * as authApi from '@/lib/api/auth';

const { Title } = Typography;

export default function RegisterPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checkingAccount, setCheckingAccount] = useState(false);
  const [gameAccountStatus, setGameAccountStatus] = useState<{
    checked: boolean;
    exists: boolean;
    error: boolean;
    message: string;
  }>({ checked: false, exists: false, error: false, message: '' });

  const handleCheckGameAccount = useCallback(async () => {
    const gameAccountName = form.getFieldValue('gameAccountName')?.trim();
    if (!gameAccountName || gameAccountName.length < 4) {
      setGameAccountStatus({ checked: false, exists: false, error: false, message: '' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(gameAccountName)) return;

    setCheckingAccount(true);
    try {
      const result = await authApi.checkGameAccount(gameAccountName);
      setGameAccountStatus({
        checked: true,
        exists: result.exists,
        error: false,
        message: result.message,
      });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const msg = error?.response?.data?.message || '檢查遊戲帳號失敗';
      setGameAccountStatus({
        checked: true,
        exists: false,
        error: true,
        message: typeof msg === 'string' ? msg : '檢查遊戲帳號失敗',
      });
    } finally {
      setCheckingAccount(false);
    }
  }, [form]);

  const onFinish = async (values: {
    gameAccountName: string;
    password: string;
    secondPassword: string;
  }) => {
    setLoading(true);
    try {
      await authApi.playerRegister({
        gameAccountName: values.gameAccountName,
        password: values.password,
        secondPassword: values.secondPassword,
      });
      message.success('註冊成功！歡迎加入無盡天堂');
      router.push('/public');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '註冊失敗';
      message.error(typeof msg === 'string' ? msg : '註冊失敗');
    } finally {
      setLoading(false);
    }
  };

  const isAccountError = gameAccountStatus.checked && gameAccountStatus.error;
  const isExistingPlayer = gameAccountStatus.checked && gameAccountStatus.exists && !isAccountError;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
        padding: '24px 0',
      }}
    >
      <Card style={{ width: 420, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          註冊帳號
        </Title>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          {/* 遊戲帳號 */}
          <Form.Item
            name="gameAccountName"
            label="遊戲帳號"
            rules={[
              { required: true, message: '請輸入遊戲帳號' },
              { min: 4, message: '遊戲帳號至少 4 個字元' },
              { max: 13, message: '遊戲帳號最多 13 個字元（受遊戲資料庫限制）' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含英文、數字和底線' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="請輸入遊戲帳號"
              size="large"
              onBlur={handleCheckGameAccount}
              suffix={checkingAccount ? <Spin size="small" /> : null}
            />
          </Form.Item>

          {/* 檢查結果提示 */}
          {gameAccountStatus.checked && (
            <Alert
              type={isAccountError ? 'error' : isExistingPlayer ? 'info' : 'success'}
              message={gameAccountStatus.message}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 遊戲密碼 */}
          <Form.Item
            name="password"
            label={isExistingPlayer ? '遊戲密碼（驗證身份）' : '遊戲密碼'}
            extra={isExistingPlayer ? '請輸入您目前的遊戲密碼來驗證身份' : '此密碼將同時作為官網登入密碼'}
            rules={[
              { required: true, message: '請輸入遊戲密碼' },
              ...(isExistingPlayer ? [] : [{ min: 6, message: '密碼至少 6 位' }]),
              { max: 50, message: '密碼最多 50 個字元' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={isExistingPlayer ? '輸入您目前的遊戲密碼' : '設定遊戲密碼'}
              size="large"
            />
          </Form.Item>

          {/* 第二組密碼 */}
          <Form.Item
            name="secondPassword"
            label="第二組密碼"
            extra="用於密碼變更等重要操作，請牢記此密碼"
            dependencies={['password']}
            rules={[
              { required: true, message: '請輸入第二組密碼' },
              { min: 6, message: '第二組密碼至少 6 位' },
              { max: 50, message: '第二組密碼最多 50 個字元' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') !== value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('第二組密碼不能與遊戲密碼相同'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="第二組密碼"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              disabled={isAccountError}
            >
              註冊
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <a href="/auth/login">已有帳號？前往登入</a>
          </div>
        </Form>
      </Card>
    </div>
  );
}
