'use client';

import { useState } from 'react';
import { Card, Form, Input, Button, message, Alert } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { agentChangePassword } from '@/lib/api/commission';

export default function AgentSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: {
    oldPassword: string;
    newPassword: string;
  }) => {
    setLoading(true);
    try {
      await agentChangePassword(values.oldPassword, values.newPassword);
      message.success('密碼已變更，下次登入請使用新密碼');
      form.resetFields();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg || '密碼變更失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="帳號設定" style={{ maxWidth: 500 }}>
      <Alert
        type="info"
        showIcon
        message="變更密碼後，下次登入請使用新密碼"
        style={{ marginBottom: 24 }}
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="目前密碼"
          name="oldPassword"
          rules={[{ required: true, message: '請輸入目前密碼' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="輸入目前的密碼"
            size="large"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item
          label="新密碼"
          name="newPassword"
          rules={[
            { required: true, message: '請輸入新密碼' },
            { min: 6, message: '新密碼至少 6 位' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="輸入新密碼"
            size="large"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          label="確認新密碼"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '請再次輸入新密碼' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('兩次密碼不一致'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="再次輸入新密碼"
            size="large"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            size="large"
            block
          >
            變更密碼
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
