'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Table,
  Tag,
  Spin,
  Result,
  Descriptions,
  Divider,
  message,
  Empty,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  ShoppingOutlined,
  KeyOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import {
  getPlayerProfile,
  changePassword,
  changeSecondPassword,
} from '@/lib/api/auth';
import { getMyOrders } from '@/lib/api/shop';
import { getAccessToken } from '@/lib/api/client';
import type { PlayerProfile, Order } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

const orderStatusMap: Record<Order['status'], { label: string; color: string }> = {
  pending: { label: '待付款', color: 'orange' },
  paid: { label: '已付款', color: 'green' },
  failed: { label: '失敗', color: 'red' },
  cancelled: { label: '已取消', color: 'default' },
};

const deliveryStatusMap: Record<Order['deliveryStatus'], { label: string; color: string }> = {
  pending: { label: '待發放', color: 'orange' },
  delivered: { label: '已發放', color: 'green' },
  failed: { label: '發放失敗', color: 'red' },
};

export default function ProfilePage() {
  const router = useRouter();
  const [changePwForm] = Form.useForm();
  const [changeSecondPwForm] = Form.useForm();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [changeSecondPwLoading, setChangeSecondPwLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = getAccessToken('player');
      if (!token) {
        setIsLoggedIn(false);
        setCheckingAuth(false);
        return;
      }

      setIsLoggedIn(true);
      setCheckingAuth(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await getPlayerProfile();
      setProfile(data);
    } catch {
      // ignore
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async (page: number) => {
    setOrdersLoading(true);
    try {
      const result = await getMyOrders(page, 10);
      setOrders(result.items);
      setOrdersTotal(result.total);
    } catch {
      // ignore
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchProfile();
      fetchOrders(ordersPage);
    }
  }, [isLoggedIn, ordersPage, fetchProfile, fetchOrders]);

  const handleChangePassword = async (values: {
    secondPassword: string;
    newPassword: string;
  }) => {
    setChangePwLoading(true);
    try {
      await changePassword({
        secondPassword: values.secondPassword,
        newPassword: values.newPassword,
      });
      message.success('遊戲密碼已成功更新');
      changePwForm.resetFields();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || '密碼更新失敗');
    } finally {
      setChangePwLoading(false);
    }
  };

  const handleChangeSecondPassword = async (values: {
    password: string;
    currentSecondPassword: string;
    newSecondPassword: string;
  }) => {
    setChangeSecondPwLoading(true);
    try {
      await changeSecondPassword({
        password: values.password,
        currentSecondPassword: values.currentSecondPassword,
        newSecondPassword: values.newSecondPassword,
      });
      message.success('第二組密碼已成功更新');
      changeSecondPwForm.resetFields();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error?.response?.data?.message || '第二組密碼更新失敗');
    } finally {
      setChangeSecondPwLoading(false);
    }
  };

  const orderColumns: ColumnsType<Order> = [
    {
      title: '訂單編號',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 180,
    },
    {
      title: '金額',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      render: (amount: string) => <Text strong>NT$ {amount}</Text>,
    },
    {
      title: '付款狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Order['status']) => (
        <Tag color={orderStatusMap[status].color}>
          {orderStatusMap[status].label}
        </Tag>
      ),
    },
    {
      title: '發放狀態',
      dataIndex: 'deliveryStatus',
      key: 'deliveryStatus',
      width: 100,
      render: (status: Order['deliveryStatus']) => (
        <Tag color={deliveryStatusMap[status].color}>
          {deliveryStatusMap[status].label}
        </Tag>
      ),
    },
    {
      title: '建立時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ];

  if (checkingAuth) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Result
        status="403"
        title="請先登入"
        subTitle="您需要登入才能查看個人中心。"
        extra={
          <Button type="primary" onClick={() => router.push('/auth/login')}>
            前往登入
          </Button>
        }
      />
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingTop: 'var(--header-total-height, 89px)' }}>
      <Title level={2} style={{ marginBottom: 32 }}>
        <UserOutlined style={{ marginRight: 8 }} />
        個人中心
      </Title>

      {/* ─── Profile Info ───────────────────────────────────────── */}
      <Card
        title={
          <span>
            <UserOutlined style={{ marginRight: 8 }} />
            個人資料
          </span>
        }
        style={{ marginBottom: 24, borderRadius: 12 }}
      >
        {profileLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : profile ? (
          <Descriptions column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label="遊戲帳號">
              <Text strong>{profile.gameAccountName}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="帳號狀態">
              <Tag color={profile.isActive ? 'green' : 'red'}>
                {profile.isActive ? '啟用' : '停用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最後登入">
              {profile.lastLoginAt
                ? dayjs(profile.lastLoginAt).format('YYYY-MM-DD HH:mm')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="註冊時間">
              {dayjs(profile.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="無法載入個人資料" />
        )}
      </Card>

      {/* ─── Change Game Password ──────────────────────────────── */}
      <Card
        title={
          <span>
            <LockOutlined style={{ marginRight: 8 }} />
            修改遊戲密碼
          </span>
        }
        style={{ marginBottom: 24, borderRadius: 12 }}
      >
        <Form
          form={changePwForm}
          layout="vertical"
          onFinish={handleChangePassword}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="secondPassword"
            label="第二組密碼（驗證身份）"
            rules={[
              { required: true, message: '請輸入第二組密碼' },
              { min: 6, message: '密碼至少 6 位' },
            ]}
          >
            <Input.Password
              prefix={<SafetyOutlined />}
              placeholder="輸入您的第二組密碼"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新遊戲密碼"
            rules={[
              { required: true, message: '請輸入新密碼' },
              { min: 6, message: '密碼至少 6 位' },
              { max: 50, message: '密碼最多 50 個字元' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="輸入新的遊戲密碼"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={changePwLoading}
              icon={<LockOutlined />}
            >
              確認修改
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* ─── Change Second Password ────────────────────────────── */}
      <Card
        title={
          <span>
            <KeyOutlined style={{ marginRight: 8 }} />
            修改第二組密碼
          </span>
        }
        style={{ marginBottom: 24, borderRadius: 12 }}
      >
        <Form
          form={changeSecondPwForm}
          layout="vertical"
          onFinish={handleChangeSecondPassword}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="password"
            label="遊戲密碼（驗證身份）"
            rules={[
              { required: true, message: '請輸入遊戲密碼' },
              { min: 6, message: '密碼至少 6 位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="輸入您的遊戲密碼"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="currentSecondPassword"
            label="當前第二組密碼"
            rules={[
              { required: true, message: '請輸入當前第二組密碼' },
              { min: 6, message: '密碼至少 6 位' },
            ]}
          >
            <Input.Password
              prefix={<SafetyOutlined />}
              placeholder="輸入當前的第二組密碼"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="newSecondPassword"
            label="新第二組密碼"
            rules={[
              { required: true, message: '請輸入新的第二組密碼' },
              { min: 6, message: '密碼至少 6 位' },
              { max: 50, message: '密碼最多 50 個字元' },
            ]}
          >
            <Input.Password
              prefix={<KeyOutlined />}
              placeholder="輸入新的第二組密碼"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={changeSecondPwLoading}
              icon={<KeyOutlined />}
            >
              確認修改
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* ─── Orders ────────────────────────────────────────────── */}
      <Card
        title={
          <span>
            <ShoppingOutlined style={{ marginRight: 8 }} />
            我的訂單
          </span>
        }
        style={{ borderRadius: 12 }}
      >
        {orders.length === 0 && !ordersLoading ? (
          <Empty description="尚無訂單記錄" />
        ) : (
          <Table<Order>
            columns={orderColumns}
            dataSource={orders}
            rowKey="id"
            loading={ordersLoading}
            pagination={{
              current: ordersPage,
              total: ordersTotal,
              pageSize: 10,
              onChange: (p) => setOrdersPage(p),
              showSizeChanger: false,
            }}
            scroll={{ x: 680 }}
          />
        )}
      </Card>

      <Divider />
    </div>
  );
}
