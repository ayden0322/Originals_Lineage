'use client';

import { useEffect } from 'react';
import { Layout, Menu, theme, Button, Space } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  SettingOutlined,
  LogoutOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { Spin } from 'antd';
import { useAuth } from '@/components/providers/AuthProvider';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/module/dashboard', icon: <DashboardOutlined />, label: '儀表板' },
  { key: '/module/members', icon: <UserOutlined />, label: '會員管理' },
  { key: '/module/reservations', icon: <CalendarOutlined />, label: '預約管理' },
  {
    key: 'shop',
    icon: <ShoppingOutlined />,
    label: '商城管理',
    children: [
      { key: '/module/shop/products', label: '商品管理' },
      { key: '/module/shop/orders', label: '訂單管理' },
    ],
  },
  {
    key: 'site-manage',
    icon: <GlobalOutlined />,
    label: '網站管理',
    children: [
      { key: '/module/site-manage/settings', label: '網站設定' },
      {
        key: 'carousel',
        label: '首頁輪播設定',
        children: [
          { key: '/module/site-manage/carousel/sections', label: '區塊輪播設定' },
          { key: '/module/site-manage/carousel/nav-style', label: '輪播標題樣式' },
        ],
      },
      {
        key: 'news',
        label: '版面設定',
        children: [
          { key: '/module/site-manage/news', label: '最新消息' },
        ],
      },
      { key: '/module/site-manage/changelog', label: '更新頁面管理' },
    ],
  },
  {
    key: 'content',
    icon: <FileTextOutlined />,
    label: '內容管理',
    children: [
      { key: '/module/content/categories', label: '分類管理' },
      { key: '/module/content/articles', label: '文章管理' },
      { key: '/module/content/announcements', label: '公告管理' },
    ],
  },
  { key: '/module/settings', icon: <SettingOutlined />, label: '模組設定' },
];

export default function ModuleAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/originals/admin-login');
    }
  }, [loading, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/originals/admin-login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="80">
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16,
          }}
        >
          始祖天堂
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          defaultOpenKeys={['site-manage', 'carousel', 'news', 'content', 'shop']}
          items={menuItems}
          onClick={({ key }) => {
            // Only navigate for leaf items (those with actual paths)
            if (key.startsWith('/')) router.push(key);
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <Space>
            <span>{user?.displayName || '工作人員'}</span>
            <Button icon={<LogoutOutlined />} type="text" onClick={handleLogout}>
              登出
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
